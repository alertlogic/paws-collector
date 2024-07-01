/* -----------------------------------------------------------------------------
 * @copyright (C) 2024, Alert Logic, Inc
 * @doc
 *
 * ciscomeraki class.
 *
 * @end
 * -----------------------------------------------------------------------------
 */
'use strict';

const moment = require('moment');
const PawsCollector = require('@alertlogic/paws-collector').PawsCollector;
const parse = require('@alertlogic/al-collector-js').Parse;
const packageJson = require('./package.json');
const calcNextCollectionInterval = require('@alertlogic/paws-collector').calcNextCollectionInterval;
const merakiClient = require("./meraki_client");
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;
const MAX_POLL_INTERVAL = 900;
const API_THROTTLING_ERROR = 429;
const API_NOT_FOUND_ERROR = 404;
const NOT_FOUND_ERROR_MAX_RETRIES = 3;

const typeIdPaths = [{ path: ["type"] }];
const tsPaths = [{ path: ["occurredAt"] }];

class CiscomerakiCollector extends PawsCollector {
    constructor(context, creds) {
        super(context, creds, packageJson.version);
        this.productTypes = process.env.paws_collector_param_string_1 ? JSON.parse(process.env.paws_collector_param_string_1) : [];
        this.apiEndpoint = process.env.paws_endpoint.replace(/^https:\/\/|\/$/g, '');
        this.orgKey = process.env.paws_collector_param_string_2;
    }

    async pawsInitCollectionState(event, callback) {
        let collector = this;
        try {
            const resourceNames = process.env.collector_streams ? JSON.parse(process.env.collector_streams) : [];
            if (resourceNames.length > 0) {
                const initialStates = this.generateInitialStates(resourceNames);
                return callback(null, initialStates, 1);
            }
            else {
                try {
                    const payloadObj = merakiClient.getOrgKeySecretEndPoint(collector);
                    let networks = await merakiClient.listNetworkIds(payloadObj);
                    if (networks.length > 0) {
                        const initialStates = this.generateInitialStates(networks);
                        return callback(null, initialStates, 1);
                    } else {
                        return callback("Error: No networks found");
                    }
                } catch (error) {
                    return callback(error);
                }
            }

        } catch (error) {
            return callback(error);
        }
    }

    generateInitialStates(networkIds) {
        const startTs = process.env.paws_collection_start_ts ?
            process.env.paws_collection_start_ts :
            moment().toISOString();
        const endTs = moment(startTs).add(this.pollInterval, 'seconds').toISOString();
        const initialStates = networkIds.map(networkId => ({
            networkId: networkId,
            since: startTs,
            until: endTs,
            nextPage: null,
            poll_interval_sec: parseInt(Math.floor(Math.random() * 30) + 1)
        }));
        return initialStates;
    }

    async handleEvent(event) {
        let collector = this;
        let context = this._invokeContext;
        let parsedEvent = collector._parseEvent(event);

        switch (parsedEvent.RequestType) {
            case 'ScheduledEvent':
                switch (parsedEvent.Type) {
                    case 'SelfUpdate':
                        await collector.handleUpdateStreamsFromNetworks();
                        return collector.handleUpdate();
                        break;
                    default:
                        super.handleEvent(event);
                }
            default:
                super.handleEvent(event);
        }
    }

    async handleUpdateStreamsFromNetworks() {
        let collector = this;
        try {
            const payloadObj = merakiClient.getOrgKeySecretEndPoint(collector);
            //get networks from api
            let networks = await merakiClient.listNetworkIds(payloadObj);
            const keyValue = `${process.env.customer_id}/${collector._pawsCollectorType}/${collector.collector_id}/networks_${collector.collector_id}.json`;
            let params = await merakiClient.getS3ObjectParams(keyValue, undefined);
            
            //get networks json from s3 bucket
            let networksFromS3 = await merakiClient.fetchJsonFromS3Bucket(params.bucketName, params.key);
            AlLogger.debug(`CMRI0000025 networks: ${JSON.stringify(networks)} networksFromS3 ${JSON.stringify(params)} ${JSON.stringify(networksFromS3)}`);
            if (networks.length > 0 && Array.isArray(networksFromS3) && networksFromS3.length > 0) {
                let differenceNetworks = merakiClient.differenceOfNetworksArray(networks, networksFromS3);
                AlLogger.debug(`CMRI0000024 Networks updated ${JSON.stringify(differenceNetworks)}`);

                if (differenceNetworks.length > 0) {
                    const initialStates = this.generateInitialStates(differenceNetworks);
                    AlLogger.debug(`CMRI0000020: SQS message added ${JSON.stringify(initialStates)}`);
                    collector._storeCollectionState({}, initialStates, this.pollInterval, async () => {
                        await merakiClient.uploadNetworksListInS3Bucket(keyValue, networks);
                    });
                } 
            } else if (networksFromS3 && collector._isFileMissingError(networksFromS3.Code)) {
                AlLogger.debug(`CMRI0000026 networks ${JSON.stringify(params)} ${JSON.stringify(networks)}`);
                await merakiClient.uploadNetworksListInS3Bucket(keyValue, networks);
            }
        } catch (error) {
            AlLogger.debug(`Error updating streams from networks: ${error.message}`);
        }
    }

    _isFileMissingError(code) { 
        return code === 'NoSuchKey' || code === 'AccessDenied';
    }

    pawsGetLogs(state, callback) {
        const collector = this;

        if (!collector.productTypes) {
            return callback("The Product Types was not found!");
        }

        const { clientSecret, apiEndpoint, orgKey } = merakiClient.getOrgKeySecretEndPoint(collector);

        const apiDetails = merakiClient.getAPIDetails(orgKey, collector.productTypes);
        if (!apiDetails.url) {
            return callback("The API name was not found!");
        }
        AlLogger.info(`CMRI000001 Collecting data for NetworkId-${state.networkId} from ${state.since}`);
        merakiClient.getAPILogs(apiDetails, [], apiEndpoint, state, clientSecret, process.env.paws_max_pages_per_invocation)
            .then(({ accumulator, nextPage }) => {
                let newState;
                if (nextPage === undefined) {
                    newState = this._getNextCollectionState(state);
                } else {
                    newState = this._getNextCollectionStateWithNextPage(state, nextPage);
                }
                AlLogger.info(`CMRI000002 Next collection in ${newState.poll_interval_sec} seconds`);
                return callback(null, accumulator, newState, newState.poll_interval_sec);
            })
            .catch((error) => {
                if (error && error.response && error.response.status == API_THROTTLING_ERROR) {
                    collector.handleThrottlingError(error, state, callback);
                } else {
                    collector.handleOtherErrors(error, state, callback);
                }
            });
    }

    handleThrottlingError(error, state, callback) {
        const maxRandom = 5;
        let retry = parseInt(error.response.headers['retry-after']) || 1;
        retry += Math.floor(Math.random() * (maxRandom + 1));
        state.poll_interval_sec = state.poll_interval_sec < MAX_POLL_INTERVAL ?
            parseInt(state.poll_interval_sec) + retry : MAX_POLL_INTERVAL;
        AlLogger.info(`CMRI000007 Throttling error, retrying after ${state.poll_interval_sec} sec`);
        this.reportApiThrottling(function () {
            return callback(null, [], state, state.poll_interval_sec);
        });
    }

    handleOtherErrors(error, state, callback) {
        if (error && error.response && error.response.status == API_NOT_FOUND_ERROR) {
            state.retry = state.retry ? state.retry + 1 : 1;
            if (state.retry > NOT_FOUND_ERROR_MAX_RETRIES) {
                AlLogger.debug(`CMRI0000021 Deleted SQS message from Queue${JSON.stringify(state)}`);
                this._invokeContext.succeed();
            } else {
                return callback(error);
            }
        } else if (error && error.response && error.response.data) {
            AlLogger.debug(`CMRI0000022 error ${error.response.data.errors} - status: ${error.response.status}`);
            error.response.data.errorCode = error.response.status;
            return callback(error.response.data);
        } else {
            return callback(error);
        }
    }

    _getNextCollectionState(curState) {
        const untilMoment = moment(curState.until);
        const { nextUntilMoment, nextSinceMoment, nextPollInterval } = calcNextCollectionInterval('no-cap', untilMoment, this.pollInterval);
        return {
            networkId: curState.networkId,
            since: nextSinceMoment.toISOString(),
            until: nextUntilMoment.toISOString(),
            nextPage: null,
            poll_interval_sec: nextPollInterval
        };
    }

    _getNextCollectionStateWithNextPage({ networkId, since, until }, nextPage) {
        const obj = {
            networkId,
            since: nextPage,
            until,
            nextPage: null,
            poll_interval_sec: 1
        };
        return obj;
    }

    pawsGetRegisterParameters(event, callback) {
        const regValues = {
            ciscoMerakiObjectNames: process.env.collector_streams
        };
        callback(null, regValues);
    }

    pawsFormatLog(msg) {
        let collector = this;

        let ts = parse.getMsgTs(msg, tsPaths);
        let typeId = parse.getMsgTypeId(msg, typeIdPaths);

        let formattedMsg = {
            hostname: collector.collector_id,
            messageTs: ts.sec,
            priority: 11,
            progName: 'CiscomerakiCollector',
            message: JSON.stringify(msg),
            messageType: 'json/ciscomeraki',
            application_id: collector.application_id
        };

        if (typeId !== null && typeId !== undefined) {
            formattedMsg.messageTypeId = `${typeId}`;
        }
        if (ts.usec) {
            formattedMsg.messageTsUs = ts.usec;
        }
        return formattedMsg;
    }
}

module.exports = {
    CiscomerakiCollector: CiscomerakiCollector
}