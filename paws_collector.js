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

const async = require('async');
const debug = require('debug')('index');
const AWS = require('aws-sdk');
const fs = require('fs');
const moment = require('moment');

const AlAwsCollector = require('@alertlogic/al-aws-collector-js').AlAwsCollector;
const m_packageJson = require('./package.json');

const CREDS_FILE_PATH = '/tmp/paws_creds.json';
var PAWS_DECRYPTED_CREDS = null;

function getPawsParamStoreParam(){
    return new Promise((resolve, reject) => {
        var ssm = new AWS.SSM();
        var params = {
            Name: process.env.paws_secret_param_name
        };
        ssm.getParameter(params, function(err, {Parameter:{Value}}) {
            if (err) reject(err, err.stack);
            else     resolve(Buffer.from(Value, 'base64'));
        });
    });
}

function getDecryptedPawsCredentials(credsBuffer) {
    return new Promise((resolve, reject) => {
        if (PAWS_DECRYPTED_CREDS) {
            return resolve(PAWS_DECRYPTED_CREDS);
        } else {
            const kms = new AWS.KMS();
            kms.decrypt(
                {CiphertextBlob: credsBuffer},
                (err, data) => {
                    if (err) {
                        return reject(err);
                    } else {
                        PAWS_DECRYPTED_CREDS = {
                            auth_type: process.env.paws_api_auth_type,
                            client_id: process.env.paws_api_client_id,
                            secret: data.Plaintext.toString('ascii')
                        };

                        return resolve(PAWS_DECRYPTED_CREDS);
                    }
                });
        }
    });
}

class PawsCollector extends AlAwsCollector {

    static load() {
        return AlAwsCollector.load().then(function(aimsCreds) {

            return getPawsParamStoreParam()
                .then(getDecryptedPawsCredentials)
                .then(pawsCreds => ({aimsCreds, pawsCreds}));
        });
    }

    constructor(context, {aimsCreds, pawsCreds}) {
        super(context, 'paws',
              AlAwsCollector.IngestTypes.LOGMSGS,
              m_packageJson.version,
              aimsCreds,
              null, [], []);
        console.info('PAWS000100 Loading collector', process.env.paws_type_name);
        this._pawsCreds = pawsCreds;
        this._pawsCollectorType = process.env.paws_type_name;
        this.pollInterval = process.env.paws_poll_interval;
        this.application_id = process.env.al_application_id;
    };

    get secret () {
        return this._pawsCreds.secret;
    };

    get clientId () {
        return this._pawsCreds.client_id;
    };

    get authType() {
        return this._pawsCreds.auth_type;
    };

    getProperties() {
        const baseProps = super.getProperties();
        let pawsProps = {
            pawsCollectorType : this._pawsCollectorType,
            pawsEndpoint : process.env.paws_endpoint
        };
        return Object.assign(pawsProps, baseProps);
    };

    register(event) {
        let collector = this;
        let pawsRegisterProps = this.getProperties();

        async.waterfall([
            function(asyncCallback) {
                return collector.pawsInitCollectionState(event, asyncCallback);
            },
            function(state, nextInvocationTimeout, asyncCallback) {
                return collector._storeCollectionState({}, state, nextInvocationTimeout, asyncCallback);
            },
            function(sqsResponse, asyncCallback) {
                return collector.pawsGetRegisterParameters(event, asyncCallback);
            }
        ], function(err, customRegister) {
            if (err) {
                console.err('PAWS000101 Error during registration', err);
                return collector.done(err);
            } else {
                let registerProps = Object.assign(pawsRegisterProps, customRegister);
                return AlAwsCollector.prototype.register.call(collector, event, registerProps);
            }
        });
    };

    deregister(event) {
        let collector = this;
        let pawsRegisterProps = {
            pawsCollectorType : collector._pawsCollectorType
        };
        let custom = collector.pawsGetRegisterParameters(event, function(err, customRegister) {
            if (err) {
                console.warn('PAWS000102 Error during deregistration', err);
            }
            let registerProps = Object.assign(pawsRegisterProps, customRegister);
            return AlAwsCollector.prototype.deregister.call(collector, event, registerProps);
        });
    };

    handleEvent(event) {
        let collector = this;
        if (event.Records) {
            let stateMsg = event.Records[0];
            if (stateMsg.eventSourceARN === process.env.paws_state_queue_arn) {
                return collector.handlePollRequest(stateMsg);
            } else {
                return super.handleEvent(event);
            }
        } else {
            return super.handleEvent(event);
        }
    };

    handlePollRequest(stateSqsMsg) {
        let collector = this;
        let pawsState = JSON.parse(stateSqsMsg.body);

        async.waterfall([
            function(asyncCallback) {
                return collector.pawsGetLogs(pawsState.priv_collector_state, asyncCallback);
            },
            function(logs, privCollectorState, nextInvocationTimeout, asyncCallback) {
                console.info('PAWS000200 Log events received ', logs.length);
                return collector.processLog(logs, collector.pawsFormatLog.bind(collector), null, function(err) {
                    return asyncCallback(err, privCollectorState, nextInvocationTimeout);
                });
            },
            function(privCollectorState, nextInvocationTimeout, asyncCallback) {
                return collector._storeCollectionState(pawsState, privCollectorState, nextInvocationTimeout, asyncCallback);
            }
        ], function(error) {
            collector.done(error);
        });
    };

    reportApiThrottling(callback) {
        // TODO: report collector status via Ingest/agentstatus
        var cloudwatch = new AWS.CloudWatch({apiVersion: '2010-08-01'});
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
        return cloudwatch.putMetricData(params, callback);
    };

    _storeCollectionState(pawsState, privCollectorState, invocationTimeout, callback) {
        if (Array.isArray(privCollectorState)) {
            return this._storeCollectionStateArray(pawsState, privCollectorState, invocationTimeout, callback);
        } else {
            return this._storeCollectionStateSingle(pawsState, privCollectorState, invocationTimeout, callback);
        }
    }

    _storeCollectionStateArray(pawsState, privCollectorStates, invocationTimeout, callback) {
        let collector = this;
        var sqs = new AWS.SQS({apiVersion: '2012-11-05'});
        const nextInvocationTimeout = invocationTimeout ? invocationTimeout : collector.pollInterval;
        let SQSMsgs = privCollectorStates.map(function(privState, index) {
            let pState = pawsState;
            pState.priv_collector_state = privState;
            return {
                Id: index.toString(),
                MessageBody: JSON.stringify(pawsState),
                DelaySeconds: nextInvocationTimeout
            };
        });

        var promises = [];
        const SQS_BATCH_LIMIT = 10
        for (let i = 0; i < SQSMsgs.length; i += SQS_BATCH_LIMIT) {
            let params = {
                Entries: SQSMsgs.slice(i, i + SQS_BATCH_LIMIT),
                QueueUrl: process.env.paws_state_queue_url
            };
            let promise = new Promise((resolve, reject) => {
                sqs.sendMessageBatch(params, (err, data) => {
                    if(err) reject(err);
                    resolve(data);
                })
            });
            promises.push(promise);
        }

        // Current state message will be removed by Lambda trigger upon successful completion
        Promise.all(promises)
        .then(results => {
            return callback(null);
        }).catch(error => {
            return callback(error);
        });
    }

    _storeCollectionStateSingle(pawsState, privCollectorState, invocationTimeout, callback) {
        let collector = this;
        var sqs = new AWS.SQS({apiVersion: '2012-11-05'});
        const nextInvocationTimeout = invocationTimeout ? invocationTimeout : collector.pollInterval;
        pawsState.priv_collector_state = privCollectorState;

        const params = {
            MessageBody: JSON.stringify(pawsState),
            QueueUrl: process.env.paws_state_queue_url,
            DelaySeconds: nextInvocationTimeout
        };
        // Current state message will be removed by Lambda trigger upon successful completion
        sqs.sendMessage(params, callback);
    };

    /**
     * @function collector callback to initialize collection state
     * @param event - collector register event coming in from CFT.
     * @param callback
     * @returns callback - (error, stateObjectOrArray, nextInvocationTimeoutSec).
     *
     */
    pawsInitCollectionState(event, callback) {
        throw Error("not implemented pawsInitCollectionState()");
    }

    /**
     * @function collector callback to receive logs data
     * @param state - collection state specific to a PAWS collector.
     * @param callback
     * @returns callback - (error, logsArray, stateObjectOrArray, nextInvocationTimeoutSec).
     *
     */
    pawsGetLogs(state, callback) {
        throw Error("not implemented pawsGetLogs()");
    };

    /**
     * @function collector callback to get specific (de)registration parameters
     * @param event - collector register event coming in from CFT during stack Create/Delete operations.
     * @param callback
     * @returns callback - (error, objectWithRegistrationProperties)
     *
     */
    pawsGetRegisterParameters(event, callback) {
        return callback(null, {});
    };

    /**
     * @function collector callback to format received data
     * Refer to al-collector-js.buildPayload parseCallback parameter
     */
    pawsFormatLog() {
        throw Error("not implemented pawsFormatLog()");
    };

}

module.exports = {
    PawsCollector: PawsCollector
}
