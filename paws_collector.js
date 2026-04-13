/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * Lambda function for polling 3rd party service log API and ingest retrieved data
 * into Alert Logic backend.
 *
 * @end
 * -----------------------------------------------------------------------------
 */
'use strict';

const {
    CloudWatch
} = require("@aws-sdk/client-cloudwatch"),
    {
        DynamoDB
    } = require("@aws-sdk/client-dynamodb"),
    {
        KMS
    } = require("@aws-sdk/client-kms"),
    {
        SQS
    } = require("@aws-sdk/client-sqs"),
    {
        SSM
    } = require("@aws-sdk/client-ssm");
const { NodeHttpHandler } = require("@smithy/node-http-handler");
const http = require("http");
const https = require("https");
const fs = require('fs');
const moment = require('moment');
const ddLambda = require('datadog-lambda-js');
const crypto = require('crypto');

const AlAwsCollectorV2 = require('@alertlogic/al-aws-collector-js').AlAwsCollectorV2;
const AlAwsCommon = require('@alertlogic/al-aws-collector-js').AlAwsCommon;
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;
const HealthChecks = require('./paws_health_checks');
const packageJson = require('./package.json');

const CREDS_FILE_PATH = '/tmp/paws_creds';
var PAWS_DECRYPTED_CREDS = null;
const DEFAULT_PAWS_SECRET_PARAM_TIER = 'Standard';
const DOMAIN_REGEXP = /^[htps]*:\/\/|\/$/gi;

const STATE_RECORD_COMPLETE = "COMPLETE";
const STATE_RECORD_INCOMPLETE = "INCOMPLETE";
const STATE_RECORD_FAILED = "FAILED";
const ERROR_CODE_DUPLICATE_STATE = 'DUPLICATE_STATE';
const ERROR_CODE_COMPLETED_STATE = 'COMPLETED_STATE';
const SQS_VISIBILITY_TIMEOUT = 900;
const DDB_TTL_DAYS = 14;
const DEDUP_LOG_TTL_SECONDS = 86400;
let maxSocket = process.env.maxSocket ? parseInt(process.env.maxSocket, 10) : 100;

const agent = {
    maxSockets: maxSocket,
    keepAlive: true
};

const nodeHttpHandler = new NodeHttpHandler({
    httpAgent: new http.Agent(agent),
    httpsAgent: new https.Agent(agent)
});


const DDB_OPTIONS = {
    maxAttempts: 5,
    requestHandler: nodeHttpHandler
}

const DDB = new DynamoDB(DDB_OPTIONS);

const DDB_DELETE_BATCH_OPTIONS = {
    maxBatchSize: 25,
    maxBatchSizeBytes: 16 * 1024 * 1024
};
const MAX_ERROR_RETRIES = 5;
let MAX_LOG_BATCH_SIZE = 10000;
const REMAINING_CONTEXT_TIME_IN_MS = 10 * 1000;

async function getPawsParamStoreParam() {
    if (fs.existsSync(CREDS_FILE_PATH) && fs.statSync(CREDS_FILE_PATH).size !== 0) {
        if (process.env.ssm_direct) {
            return fs.readFileSync(CREDS_FILE_PATH, 'utf-8');
        }
        return fs.readFileSync(CREDS_FILE_PATH);
    }

    const ssm = new SSM();
    const params = {
        Name: process.env.paws_secret_param_name
    };

    if (process.env.ssm_direct) {
        params.WithDecryption = true;
    }

    const ssmParamRes = await ssm.getParameter(params);
    const { Parameter: { Value } } = ssmParamRes;

    let data = null;
    if (process.env.ssm_direct) {
        data = Value;
        fs.writeFileSync(CREDS_FILE_PATH, data);
    } else {
        data = Buffer.from(Value, 'base64');
        fs.writeFileSync(CREDS_FILE_PATH, data, 'base64');
    }

    return data;
}

async function getDecryptedPawsCredentials(credsBuffer) {
    if (PAWS_DECRYPTED_CREDS) {
        return PAWS_DECRYPTED_CREDS;
    }

    if (process.env.ssm_direct) {
        PAWS_DECRYPTED_CREDS = {
            auth_type: process.env.paws_api_auth_type,
            client_id: process.env.paws_api_client_id,
            secret: credsBuffer
        };
        return PAWS_DECRYPTED_CREDS;
    }

    const kms = new KMS();
    const data = await kms.decrypt({ CiphertextBlob: credsBuffer });

    PAWS_DECRYPTED_CREDS = {
        auth_type: process.env.paws_api_auth_type,
        client_id: process.env.paws_api_client_id,
        secret: new TextDecoder("utf-8").decode(data.Plaintext)
    };

    return PAWS_DECRYPTED_CREDS;
}

class PawsCollector extends AlAwsCollectorV2 {

    static async load() {

        const aimsCreds = await AlAwsCollectorV2.load();
        const credsBuffer = await getPawsParamStoreParam();
        const pawsCreds = await getDecryptedPawsCredentials(credsBuffer);
        return { aimsCreds, pawsCreds };
    }

  
    static makeHandler(handlerFunc) {
        if (process.env.DD_API_KEY || process.env.DD_KMS_API_KEY) {
            return ddLambda.datadog(handlerFunc);
        } else {
            return handlerFunc;
        }
    }
    constructor(context, { aimsCreds, pawsCreds }, childVersion, healthChecks = [], statsChecks = []) {
        const version = childVersion ? childVersion : packageJson.version;
        const endpointDomain = process.env.paws_endpoint.replace(DOMAIN_REGEXP, '');
        if (healthChecks.length === 0) {
            healthChecks.push(HealthChecks.customHealthCheck);
        }
        let collectorStreams = process.env.collector_streams && Array.isArray(JSON.parse(process.env.collector_streams)) ? JSON.parse(process.env.collector_streams) : [];
        super(context, 'paws',
            AlAwsCollectorV2.IngestTypes.LOGMSGS,
            version,
            aimsCreds,
            null, healthChecks, statsChecks, collectorStreams);
        AlLogger.info(`PAWS000100 Loading collector ${process.env.paws_type_name}`);
        this._pawsCreds = pawsCreds;
        this._pawsCollectorType = process.env.paws_type_name;
        this.pollInterval = process.env.paws_poll_interval;
        this._pawsEndpoint = process.env.paws_endpoint
        this._pawsDomainEndpoint = endpointDomain;
        this._pawsHttpsEndpoint = 'https://' + endpointDomain;
        this._pawsDdbTableName = process.env.paws_ddb_table_name;
        this._pawsDeDupLogsTableName = process.env.paws_dedup_logs_ddb_table_name;
    };

    get secret() {
        return this._pawsCreds.secret;
    };

    get clientId() {
        return this._pawsCreds.client_id;
    };

    get authType() {
        return this._pawsCreds.auth_type;
    };

    get pawsCollectorType() {
        return this._pawsCollectorType;
    };

    get pawsEndpoint() {
        return this._pawsEndpoint;
    };

    get pawsDomainEndpoint() {
        return this._pawsDomainEndpoint;
    };

    get pawsHttpsEndpoint() {
        return this._pawsHttpsEndpoint;
    };

    async done(error, pawsState, sendStatus = true) {
        // If stream exist in state then post the error status as part of stream specific ; 
        // In check-in or self-update we don't get state ,so check collector_streams env variable and post error as part of paws_{applicationId}_status
        const streamType = pawsState && pawsState.priv_collector_state.stream ?
            pawsState.priv_collector_state.stream :
            process.env.al_application_id;

        await super.done(error, streamType, sendStatus);
    }

    reportDDMetric(name, value, tags = []) {
        if (!process.env.DD_API_KEY) {
            return
        }

        const baseTags = [
            `paws_platform:${this.pawsCollectorType}`,
            `applicationId:${this.applicationId}`,
            `aws_account:${this.aws_account_id}`
        ];

        ddLambda.sendDistributionMetric(
            `paws_${this.pawsCollectorType}.${name}`,
            value,
            ...baseTags.concat(tags)
        );
    }

    hasSufficientRemainingTime(minRemainingTimeInMs = REMAINING_CONTEXT_TIME_IN_MS) {
        if (!this.context || typeof this.context.getRemainingTimeInMillis !== 'function') {
            return true;
        }

        return this.context.getRemainingTimeInMillis() > minRemainingTimeInMs;
    }

    isThrottlingError(error) {
        if (!error) {
            return false;
        }

        const code = `${error.name || ''} ${error.Code || ''} ${error.code || ''} ${error.__type || ''}`.toLowerCase();
        const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
        const httpStatusCode = error.$metadata && error.$metadata.httpStatusCode;

        return code.includes('throttl') ||
            message.includes('rate exceeded') ||
            httpStatusCode === 429;
    }

    getProperties() {
        const baseProps = super.getProperties();
        let pawsProps = {
            pawsCollectorType: this._pawsCollectorType,
            pawsEndpoint: process.env.paws_endpoint
        };
        return Object.assign(pawsProps, baseProps);
    };

    prepareErrorStatus(errorString, collectorType = this.pawsCollectorType) {
        return super.setCollectorStatus(collectorType, errorString);
    }
    /**
     * Override the super method to send the status to CloudWatch and DataDog metrics
     * @param {*} stream 
     * @param {*} collectorStatus 
     */
    async sendCollectorStatus(stream, collectorStatus) {
        try {
            await super.sendCollectorStatus(stream, collectorStatus);
            return await this.reportCollectorStatus(collectorStatus.status)
        } catch (error) {
            AlLogger.debug(`PAWS000302 Error sending collector status: ${this.stringifyError(error)}`);
            throw error;
        }
    }

    async setPawsSecret(secretValue) {
        const kms = new KMS();
        const params = {
            KeyId: process.env.paws_kms_key_arn,
            Plaintext: new TextEncoder().encode(secretValue)
        };

        const encryptData = await kms.encrypt(params);
        const base64 = Buffer.from(encryptData.CiphertextBlob).toString('base64');

        const ssm = new SSM();
        const putParams = {
            Name: process.env.paws_secret_param_name,
            Type: 'String',
            Overwrite: true,
            Value: base64,
            Tier: process.env.paws_secret_param_tier ? process.env.paws_secret_param_tier : DEFAULT_PAWS_SECRET_PARAM_TIER
        };

        try {
            return await ssm.putParameter(putParams);
        } catch (error) {
            AlLogger.error('PAWS000300 Error setting new secret', error);
            throw error;
        }
    }

    async registerPawsCollector(event) {
        let collector = this;
        let pawsRegisterProps = collector.getProperties();
        try {
            const customRegister = await collector.pawsGetRegisterParameters(event);
            let registerProps = Object.assign(pawsRegisterProps, customRegister);
            await AlAwsCollectorV2.prototype.register.call(collector, event, registerProps);
        } catch (error) {
            AlLogger.error(`PAWS000101 Error during registration ${collector.stringifyError(error)}`);
            throw error;
        };
    }

    async register(event, customUnused) {
        let collector = this;

        await collector.registerPawsCollector(event);
        const { state, nextInvocationTimeout } = await collector.pawsInitCollectionState(event);
        return await collector._storeCollectionState({}, state, nextInvocationTimeout);

    };

    async deregister(event, customUnused) {
        let collector = this;
        let pawsRegisterProps = {
            pawsCollectorType: collector._pawsCollectorType
        };
        try {
            let customRegister = await collector.pawsGetRegisterParameters(event);
            let registerProps = Object.assign(pawsRegisterProps, customRegister);
            await AlAwsCollectorV2.prototype.deregister.call(collector, event, registerProps);
        } catch (error) {
            AlLogger.warn(`PAWS000102 Error during deregistration ${collector.stringifyError(error)}`);
            throw error;
        }
    };

    async handleEvent(event) {
        let collector = this;
        if (event.Records) {
            let stateMsg = event.Records[0];
            if (stateMsg.eventSourceARN === process.env.paws_state_queue_arn) {
                return await collector.handlePollRequest(stateMsg);
            } else {
                return await super.handleEvent(event);
            }
        } else {
            return await super.handleEvent(event);
        }
    };

    // check the status of the state in DDB to avoid duplication
    async checkStateSqsMessage(stateSqsMsg) {
        const params = {
            Key: {
                "CollectorId": { S: this._collectorId },
                "MessageId": { S: stateSqsMsg.messageId }
            },
            TableName: this._pawsDdbTableName,
            ConsistentRead: true
        }
        try {
            const data = await DDB.getItem(params);
            if (data.Item) {
                const Item = data.Item;
                // check to see if record was updated within the visibility timeout of the SQS queue.
                // if it is within that limit, then it likely to be processed by another invocation and this is a duplicate
                if (Item.Status.S === STATE_RECORD_INCOMPLETE && moment().unix() - parseInt(Item.Updated.N) < SQS_VISIBILITY_TIMEOUT) {
                    AlLogger.info(`PAWS000400 Duplicate state: ${Item.MessageId.S}, already in progress. skipping`);
                    throw { errorCode: ERROR_CODE_DUPLICATE_STATE };
                } else if (Item.Status.S === STATE_RECORD_COMPLETE) {
                    AlLogger.info(`PAWS000401 Duplicate state: ${Item.MessageId.S}, already processed. skipping`);
                    throw { errorCode: ERROR_CODE_COMPLETED_STATE };
                } else {
                    return await this.updateStateDBEntry(stateSqsMsg, STATE_RECORD_INCOMPLETE);
                }
            } else {
                const newRecord = {
                    Item: {
                        CollectorId: { S: this._collectorId },
                        MessageId: { S: stateSqsMsg.messageId },
                        Updated: { N: moment().unix().toString() },
                        Cid: { S: this.cid ? this.cid : 'none' },
                        Status: { S: STATE_RECORD_INCOMPLETE },
                        ExpireDate: { N: moment().add(DDB_TTL_DAYS, 'days').unix().toString() }
                    },
                    TableName: this._pawsDdbTableName,
                    ConditionExpression: 'attribute_not_exists(CollectorId) AND attribute_not_exists(MessageId)'
                }
                return await DDB.putItem(newRecord);
            }
        } catch (error) {
            if (error && error.name === 'ConditionalCheckFailedException') {
                AlLogger.info(`PAWS000400 Duplicate state: ${stateSqsMsg.messageId}, already in progress. skipping`);
                throw { errorCode: ERROR_CODE_DUPLICATE_STATE };
            }
            AlLogger.error(`PAWS000402 ${this._pawsDdbTableName} table not found`);
            throw error;
        }
    }

    async updateStateDBEntry(stateSqsMsg, Status) {
        const collector = this;
        const updateParams = {
            Key: {
                CollectorId: { S: collector._collectorId },
                MessageId: { S: stateSqsMsg.messageId }
            },
            AttributeUpdates: {
                Updated: {
                    Action: 'PUT',
                    Value: { N: moment().unix().toString() }
                },
                Cid: {
                    Action: 'PUT',
                    Value: { S: collector.cid ? collector.cid : 'none' }
                },
                Status: {
                    Action: 'PUT',
                    Value: { S: Status }
                },
            },
            TableName: this._pawsDdbTableName
        };

        try {
            return await DDB.updateItem(updateParams);
        } catch (err) {
            throw err;
        }
    }


    async handlePollRequest(stateSqsMsg) {
        let collector = this;
        let retryPrivCollectorState;

        try {
            let pawsState = JSON.parse(stateSqsMsg.body);
            retryPrivCollectorState = pawsState.priv_collector_state;

            if (!collector.registered) {
                throw new Error('PAWS000103 Collection attempt for unregistrered collector');
            }

            await collector.checkStateSqsMessage(stateSqsMsg);

            let logs, privCollectorState, nextInvocationTimeout;
            try {
                [logs, privCollectorState, nextInvocationTimeout] = await collector.pawsGetLogs(pawsState.priv_collector_state);
                retryPrivCollectorState = privCollectorState;
            } catch (err) {
                await collector.reportClientError(err);
                throw err;
            }
            AlLogger.info(`PAWS000200 Log events received ${logs.length}`);

            const result = await collector.batchLogProcess(logs, privCollectorState, nextInvocationTimeout);
            let finalPrivCollectorState = result.privCollectorState;
            let finalNextInvocationTimeout = result.nextInvocationTimeout;

            const lastCollectedTs =
                finalPrivCollectorState.last_collected_ts ? finalPrivCollectorState.last_collected_ts :
                    finalPrivCollectorState.since ? finalPrivCollectorState.since :
                        finalPrivCollectorState.until ? finalPrivCollectorState.until :
                            null;

            if (lastCollectedTs) {
                try {
                    await collector.reportCollectionDelay(lastCollectedTs);
                } catch (metricError) {
                    AlLogger.warn(`PAWS000407 Unable to report collection delay metric: ${collector.stringifyError(metricError)}`);
                }
            }

            // Reset the retry count to 0 on successful log processing
            pawsState.retry_count = 0;
            await collector._storeCollectionState(pawsState, finalPrivCollectorState, finalNextInvocationTimeout);
            await collector.updateStateDBEntry(stateSqsMsg, STATE_RECORD_COMPLETE);
            await collector.done(null, pawsState);
        } catch (handleError) {
            try {
                if (handleError && handleError.errorCode === ERROR_CODE_DUPLICATE_STATE) {
                    // We need to fail invocation for duplicate state handling
                    // because we don't want delete SQS message which is being handled by another invocation
                    await collector.done(handleError, JSON.parse(stateSqsMsg.body), false);
                } else if (handleError && handleError.errorCode === ERROR_CODE_COMPLETED_STATE) {
                    // For already completed states we need to just remove the state message from SQS
                    await collector.done(null, JSON.parse(stateSqsMsg.body), false);
                } else {
                    const pawsState = JSON.parse(stateSqsMsg.body);
                    await collector.updateStateDBEntry(stateSqsMsg, STATE_RECORD_FAILED);

                    const remainingTimeInMillis = collector.context && collector.context.getRemainingTimeInMillis ?
                        collector.context.getRemainingTimeInMillis() :
                        0;

                    // If remaining execution time is low, do not enqueue a new state message.
                    // Failing this invocation keeps the original SQS message for retry and prevents duplicate messages.
                    if (remainingTimeInMillis <= REMAINING_CONTEXT_TIME_IN_MS) {
                        AlLogger.error(`PAWS000303 Error handling poll request with low remaining time. Keeping original SQS message for retry: ${collector.stringifyError(handleError)}`);
                        await collector.done(handleError, pawsState, false);
                        return;
                    }

                    // If collector failed to handle poll state we'd like to refresh the state message in SQS
                    // in order to avoid expiration of that message due to retention period.
                    // Here we just upload same state messaged into SQS and send error status to the backend.
                    // The invocation is marked as succeed in order to clean up current state message in SQS.
                    // Increment/reset the retry count if error occured.
                    pawsState.retry_count = (!pawsState.retry_count || pawsState.retry_count >= MAX_ERROR_RETRIES) ? 1 : pawsState.retry_count + 1;
                    const stateForRetry = retryPrivCollectorState ? retryPrivCollectorState : pawsState.priv_collector_state;

                    try {
                        await collector._storeCollectionState(pawsState, stateForRetry, 300);

                        let handleErrorString = collector.stringifyError(handleError);
                        try {
                            handleErrorString = await collector.reportErrorStatus(handleError, pawsState);
                        } catch (reportError) {
                            AlLogger.warn(`PAWS000408 Unable to report collector error status: ${collector.stringifyError(reportError)}`);
                        }
                        AlLogger.error(`PAWS000304 Error handling poll request: ${handleErrorString}`);
                        await collector.done(null, pawsState);
                    } catch (storeError) {
                        await collector.done(storeError);
                    }
                }
            } catch (exception) {
                AlLogger.error(`PAWS000201 Exception handling poll request: ${collector.stringifyError(exception)}`);
                return collector.done(exception, null, false);
            }
        }
    };

    async reportErrorStatus(error, pawsState) {
        const streamType = pawsState && pawsState.priv_collector_state.stream ?
            pawsState.priv_collector_state.stream :
            process.env.al_application_id;
        const errorString = this.stringifyError(error);
        const status = this.prepareErrorStatus(errorString, streamType);
        // Send the error status to assets only if retry count reached to 5. 
        // To reduce the status fluctuation from healthy  to unhealthy.
        if (pawsState.retry_count === MAX_ERROR_RETRIES) {
            await this.sendCollectorStatus(streamType, status);
        }
        return errorString;
    }
    /**
     * Split data per 10K messages batch.
     * Call the processLog to send Logmsgs to ingest
     * @param {*} logs 
     * @param {*} privCollectorState 
     * @param {*} nextInvocationTimeout 
     * @returns {Promise<{privCollectorState, nextInvocationTimeout}>}
     */
    async batchLogProcess(logs, privCollectorState, nextInvocationTimeout) {
        let collector = this;

        async function processBatch(logs) {
            let indexArray = [];
            const batches = Math.ceil(logs.length / MAX_LOG_BATCH_SIZE);
            for (let i = 0; i < batches; i++) {
                indexArray.push({ start: MAX_LOG_BATCH_SIZE * i, stop: MAX_LOG_BATCH_SIZE * (i + 1) });
            }
            let promises = indexArray.map(async (logpart) => {
                try {
                    return await collector.processLog(logs.slice(logpart.start, logpart.stop), collector.pawsFormatLog.bind(collector), null);
                } catch (err) {
                    if (typeof err === 'string' && err.includes("Maximum payload size exceeded")) {
                        let logsSlice = logs.slice(logpart.start, logpart.stop);
                        MAX_LOG_BATCH_SIZE = Math.ceil(logsSlice.length / 2);
                        return await processBatch(logsSlice);
                    } else {
                        await collector.handleDeDupIngestError(err, logs.slice(logpart.start, logpart.stop));
                        throw err;
                    }
                }
            });
            return await Promise.all(promises);
        }

        try {
            await processBatch(logs);
            return { privCollectorState, nextInvocationTimeout };
        } catch (error) {
            await collector.reportErrorToIngestApi(error);
            let params = collector.getS3ObjectParams(logs);
            try {
                await AlAwsCommon.handleIngestEncodingInvalidError(error, params);
                return { privCollectorState, nextInvocationTimeout };
            } catch (err) {
                throw err;
            }
        }
    }

    getS3ObjectParams(data) {
        const collector = this;
        const timeStamp = moment().format('YYYY-MM-DDTHH.mm.ss');
        const keyValue = `${process.env.customer_id}/${collector._pawsCollectorType}/${collector._collectorId}/${collector._collectorId}_${timeStamp}.json`;
        let params = {
            data: data,
            key: keyValue,
            bucketName: process.env.dl_s3_bucket_name
        }
        return params;
    }
    async reportApiThrottling() {
        var cloudwatch = new CloudWatch({ apiVersion: '2010-08-01' });
        const params = {
            MetricData: [
                {
                    MetricName: 'PawsApiThrottling',
                    Dimensions: [
                        {
                            Name: 'CollectorType',
                            Value: this._pawsCollectorType
                        },
                        {
                            Name: 'FunctionName',
                            Value: process.env.AWS_LAMBDA_FUNCTION_NAME
                        }
                    ],
                    Timestamp: new Date(),
                    Unit: 'Count',
                    Value: 1
                }
            ],
            Namespace: 'PawsCollectors'
        };
        this.reportDDMetric('api_throttling', 1)
        return await cloudwatch.putMetricData(params);
    };
    /**
     * Report the error to Ingest api service and show case on DDMetrics
     * @param error 
     */
    async reportErrorToIngestApi(error) {
        var cloudwatch = new CloudWatch({ apiVersion: '2010-08-01' });
        const params = {
            MetricData: [
                {
                    MetricName: 'PawsIngestApi',
                    Dimensions: [
                        {
                            Name: 'CollectorType',
                            Value: this._pawsCollectorType
                        },
                        {
                            Name: 'FunctionName',
                            Value: process.env.AWS_LAMBDA_FUNCTION_NAME
                        }
                    ],
                    Timestamp: new Date(),
                    Unit: 'Count',
                    Value: 1
                }
            ],
            Namespace: 'PawsCollectors'
        };
        let errorCode = 'unknown';
        if (error && error.httpErrorCode) {
            errorCode = error.httpErrorCode;
        } else if (error && error.errorCode) {
            errorCode = error.errorCode;
        }
        this.reportDDMetric("ingest_api", 1, [`result:error`, `error_code:${errorCode}`]);
        return await cloudwatch.putMetricData(params);
    };

    /**
     * Report the client errors and show case on DDMetrics and cloudwatch
     * @param error 
     */
    async reportClientError(error) {
        var cloudwatch = new CloudWatch({ apiVersion: '2010-08-01' });
        const params = {
            MetricData: [
                {
                    MetricName: "PawsClientError",
                    Dimensions: [
                        {
                            Name: 'CollectorType',
                            Value: this._pawsCollectorType
                        },
                        {
                            Name: 'FunctionName',
                            Value: process.env.AWS_LAMBDA_FUNCTION_NAME
                        }
                    ],
                    Timestamp: new Date(),
                    Unit: 'Count',
                    Value: 1
                }
            ],
            Namespace: 'PawsCollectors'
        };
        let errorCode = typeof (error) === 'object' && error.errorCode ? error.errorCode : 'unknown';
        this.reportDDMetric("client", 1, [`result:error`, `error_code:${errorCode}`]);
        return await cloudwatch.putMetricData(params);
    };

    async reportCollectionDelay(lastCollectedTs) {
        const nowMoment = moment();
        // converting the time from seconds to milliseconds . 
        const lastCollectedMoment = !isNaN(lastCollectedTs) && lastCollectedTs.toString().length == 10 ? moment.unix(lastCollectedTs) : moment(lastCollectedTs);
        const delayDuration = moment.duration(nowMoment.diff(lastCollectedMoment));
        const collectionDelaySec = Math.floor(delayDuration.asSeconds());

        var cloudwatch = new CloudWatch({ apiVersion: '2010-08-01' });
        const params = {
            MetricData: [
                {
                    MetricName: 'CollectionDelay',
                    Dimensions: [
                        {
                            Name: 'CollectorType',
                            Value: this._pawsCollectorType
                        },
                        {
                            Name: 'FunctionName',
                            Value: process.env.AWS_LAMBDA_FUNCTION_NAME
                        }
                    ],
                    Timestamp: new Date(),
                    Unit: 'Seconds',
                    Value: collectionDelaySec
                }
            ],
            Namespace: 'PawsCollectors'
        };
        this.reportDDMetric('collection_delay', collectionDelaySec);
        return await cloudwatch.putMetricData(params);
    };

    async reportDuplicateLogCount(duplicateCount) {
        this.reportDDMetric("duplicate_messages", duplicateCount);

        if (!this.hasSufficientRemainingTime()) {
            AlLogger.debug(`PAWS000409 Skipping CloudWatch duplicate metric due to low remaining lambda time`);
            return null;
        }

        var cloudwatch = new CloudWatch({ apiVersion: '2010-08-01' });
        const params = {
            MetricData: [
                {
                    MetricName: "PawsDeDupMessages",
                    Dimensions: [
                        {
                            Name: 'CollectorType',
                            Value: this._pawsCollectorType
                        },
                        {
                            Name: 'FunctionName',
                            Value: process.env.AWS_LAMBDA_FUNCTION_NAME
                        }
                    ],
                    Timestamp: new Date(),
                    Unit: 'Count',
                    Value: duplicateCount
                }
            ],
            Namespace: 'PawsCollectors'
        };
        try {
            return await cloudwatch.putMetricData(params);
        } catch (error) {
            if (this.isThrottlingError(error)) {
                AlLogger.debug(`PAWS000410 CloudWatch duplicate metric throttled; skipping metric publish`);
                return null;
            }
            throw error;
        }
    };
    /**
     * Report the collector status(ok/error)to dd metrics
     * @param {*} status 
     * @returns 
     */
    async reportCollectorStatus(status) {
        var cloudwatch = new CloudWatch({ apiVersion: '2010-08-01' });
        const params = {
            MetricData: [
                {
                    MetricName: 'PawsCollectorStatus',
                    Dimensions: [
                        {
                            Name: 'CollectorType',
                            Value: this._pawsCollectorType
                        },
                        {
                            Name: 'FunctionName',
                            Value: process.env.AWS_LAMBDA_FUNCTION_NAME
                        }
                    ],
                    Timestamp: new Date(),
                    Unit: 'Count',
                    Value: 1
                }
            ],
            Namespace: 'PawsCollectors'
        };

        this.reportDDMetric("collector_status", 1, [`status:${status}`]);
        return await cloudwatch.putMetricData(params);
    };

    async _storeCollectionState(pawsState, privCollectorState, invocationTimeout) {
        if (Array.isArray(privCollectorState)) {
            return await this._storeCollectionStateArray(pawsState, privCollectorState, invocationTimeout);
        } else {
            return await this._storeCollectionStateSingle(pawsState, privCollectorState, invocationTimeout);
        }
    }

    async _storeCollectionStateArray(pawsState, privCollectorStates, invocationTimeout) {
        const sqs = new SQS({ apiVersion: '2012-11-05' });
        const nextInvocationTimeout = invocationTimeout ? invocationTimeout : this.pollInterval;

        const SQSMsgs = privCollectorStates.map((privState, index) => {
            const pState = { ...pawsState };
            pState.priv_collector_state = privState;
            return {
                Id: index.toString(),
                MessageBody: JSON.stringify(pState),
                DelaySeconds: nextInvocationTimeout
            };
        });

        const promises = [];
        const SQS_BATCH_LIMIT = 10;

        for (let i = 0; i < SQSMsgs.length; i += SQS_BATCH_LIMIT) {
            const params = {
                Entries: SQSMsgs.slice(i, i + SQS_BATCH_LIMIT),
                QueueUrl: process.env.paws_state_queue_url
            };
            promises.push(sqs.sendMessageBatch(params));
        }

        // Current state message will be removed by Lambda trigger upon successful completion
        return await Promise.all(promises);
    }

    async _storeCollectionStateSingle(pawsState, privCollectorState, invocationTimeout) {
        let collector = this;
        var sqs = new SQS({ apiVersion: '2012-11-05' });
        const nextInvocationTimeout = invocationTimeout ? invocationTimeout : collector.pollInterval;
        pawsState.priv_collector_state = privCollectorState;

        const params = {
            MessageBody: JSON.stringify(pawsState),
            QueueUrl: process.env.paws_state_queue_url,
            DelaySeconds: nextInvocationTimeout
        };
        // Current state message will be removed by Lambda trigger upon successful completion
        await sqs.sendMessage(params);
    };

    /**
     * This function to set collector_streams in environment variable for existing collectors.
     * Streams are pass to AL-aws-collector to post stream specific status if there is no error.
     * @param {*} streams 
     */
    async setCollectorStreamsEnv(streams) {
        let collectorStreams = { collector_streams: streams };
        try {
            return await AlAwsCommon.setEnvAsync(collectorStreams);
        } catch (error) {
            AlLogger.error('PAWS000301 Paws error while adding collector_streams in environment variable');
            return null;
        }
    }

    /**
     * Get hash of message 
     * @param {*} message 
     * @returns messageHash value
     */
    getHash(message) {
        const messageHash = crypto.createHash('sha256').update(JSON.stringify(message, Object.keys(message).sort())).digest('hex');
        return messageHash;
    }

    /**
     * calculate expiry date for deduplicate table item
     * @returns expireTTLDate
     */
    calculateExpiryTs() {
        const expireTTL = process.env.expire_ttl_seconds ? process.env.expire_ttl_seconds : DEDUP_LOG_TTL_SECONDS // set default to be 24 hr.
        const expireTTLDate = moment().add(expireTTL, 'seconds').unix().toString();
        return expireTTLDate;
    }

    /**
     * 
     * @param {*} logs 
     * @param {*} paramName :Uniquely identified parameter key 
     * @returns uniqueLogs array
     */
    async removeDuplicatedItem(logs, paramName) {
        let collector = this;
        let uniqueLogs = [];
        var promises = [];
        let duplicateCount = 0;
        logs.forEach(message => {
            const itemId = collector.getDeDupItemId(message);
            const params = {
                Item: {
                    Id: { S: itemId },
                    CollectorId: { S: collector._collectorId },
                    OrigMessageId: { S: message[`${paramName}`] },
                    ExpireDate: { N: collector.calculateExpiryTs() }
                },
                TableName: collector._pawsDeDupLogsTableName,
                ConditionExpression: 'attribute_not_exists(Id)'
            };

            let promise = DDB.putItem(params)
                .then(() => {
                    uniqueLogs.push(message);
                })
                .catch(err => {
                    if (err.name === 'ConditionalCheckFailedException') {
                        duplicateCount++;
                    } else {
                        AlLogger.warn('PAWS000404 Error storing event in DynamoDB:', err);
                        throw err;
                    }
                });
            promises.push(promise);
        });

        try {
            await Promise.all(promises);
            if (duplicateCount > 0) {
                try {
                    await collector.reportDuplicateLogCount(duplicateCount);
                } catch (err) {
                    AlLogger.warn(`PAWS000405 Error publishing duplicate count metrics ${JSON.stringify(err)}`);
                }
            }
            return uniqueLogs;
        } catch (err) {
            throw err;
        }
    }
    /**
     * Return the original error after deleting the entry from DDB
     * @param {*} error 
     * @param {*} logs 
     * @returns 
     */
    async handleDeDupIngestError(error, logs) {
        let collector = this;
        if (collector.pawsCollectorType === 'o365') {
            try {
                await collector.deleteDedupLogItemEntry(logs)
            } catch (error) {
                AlLogger.warn(`PAWS000406 Error while delete item in DynamoDB ${err}`);
                throw error;
            }
        } else {
            throw error;
        }
    }
    /**
     * delete the item entry from DDB
     * @param {*} logs 
     */
    async deleteDedupLogItemEntry(logs) {
        const collector = this;
        const tableName = collector._pawsDeDupLogsTableName
        let promises = [];
        let currentBatch = [];

        for (const message of logs) {
            const itemId = collector.getDeDupItemId(message);
            const key = {
                Id: { S: itemId },
                CollectorId: { S: collector._collectorId }
            }
            currentBatch.push({ DeleteRequest: { Key: key } });
            if (collector.isDDBbatchFull(currentBatch)) {
                promises.push(collector.dDBBatchWriteItem(tableName, currentBatch));
                currentBatch = [];
            }
        }

        if (currentBatch.length > 0) {
            promises.push(collector.dDBBatchWriteItem(tableName, currentBatch));
        }

        try {
            return await Promise.all(promises);
        } catch (error) {
            throw error;
        }
    }
    /**
     * Form the unique item id which used as primary key
     * @param {*} message 
     * @returns itemId
     */
    getDeDupItemId(message) {
        const collector = this;
        const cid = collector.cid ? collector.cid : 'none';
        const collectorId = collector._collectorId;
        const messageHash = collector.getHash(message);
        return `${cid}_${collectorId}_${messageHash}`;
    }
    /**
     * Delete the ddb items in batches
     * @param {*} tableName 
     * @param {*} batch 
     * @returns 
     */
    async dDBBatchWriteItem(tableName, batch) {
        const batchParams = { RequestItems: { [tableName]: batch } };
        return await DDB.batchWriteItem(batchParams);
    }

    /**
     * Retun true or false base on ddb batch size
     * @param {*} currentBatch 
     * @returns 
     */
    isDDBbatchFull(currentBatch) {
        const itemSizeBytes = JSON.stringify(currentBatch).length;
        const batchFull = currentBatch.length === DDB_DELETE_BATCH_OPTIONS.maxBatchSize || currentBatch.length * itemSizeBytes >= DDB_DELETE_BATCH_OPTIONS.maxBatchSizeBytes;
        return batchFull;
    }
    /**
     * @function collector initialize collection state
     * @param event - collector register event coming in from CFT.
     * @returns Promise that resolves to { state, nextInvocationTimeout } or throws Error
     *
     */
    async pawsInitCollectionState(event) {
        // Return object: { state, nextInvocationTimeout }
        // or throw Error
        throw Error("not implemented pawsInitCollectionState()");
    }

    /**
     * @function collector callback to receive logs data
     * @param state - collection state specific to a PAWS collector.
     * @returns Promise that resolves to [logs, privCollectorState, nextInvocationTimeout] or throws Error
     *
     */
    async pawsGetLogs(state) {
        // Return array: [logs, privCollectorState, nextInvocationTimeout]
        // or throw Error
        throw Error("not implemented pawsGetLogs()");
    }

    /**
     * @function collector 
     * @param event - optional, collector register event coming in from CFT during stack Create/Delete operations.
     * @returns object
     *
     */
     async pawsGetRegisterParameters(event) {
        return {};
    }

    /**
     * @function collector 
     * Refer to al-collector-js.buildPayload parseCallback parameter
     */
    pawsFormatLog() {
        throw Error("not implemented pawsFormatLog()");
    };

}

module.exports = {
    PawsCollector: PawsCollector
}
