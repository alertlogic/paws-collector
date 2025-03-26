/* -----------------------------------------------------------------------------
 * @copyright (C) 2020, Alert Logic, Inc
 * @doc
 *
 * sophossiem class.
 *
 * @end
 * -----------------------------------------------------------------------------
 */
'use strict';

const moment = require('moment');
const PawsCollector = require('@alertlogic/paws-collector').PawsCollector;
const parse = require('@alertlogic/al-collector-js').Parse;
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;
const packageJson = require('./package.json');
const utils = require("./utils");

//Sophos base endpoints. These appear to be universal per the docs
const SOPHOS_AUTH_BASE_URL = "id.sophos.com";
const SOPHOS_API_BASE_URL = "api.central.sophos.com";

const typeIdPaths = [{ path: ['id'] }];

const tsPaths = [{ path: ['created_at'] }];


class SophossiemCollector extends PawsCollector {
    constructor(context, creds) {
        super(context, creds, packageJson.version);
    }

    pawsInitCollectionState(event, callback) {
        const startTs = process.env.paws_collection_start_ts ?
            process.env.paws_collection_start_ts :
            moment().toISOString();

        //From date must be within last 24 hours
        let from_date_unix;
        if (moment().diff(startTs, 'hours') < 24) {
            from_date_unix = moment(startTs).unix();
        }
        else {
            from_date_unix = moment().subtract(23, 'hours').unix();
        }

        const streams = JSON.parse(process.env.collector_streams);
        const initialStates = streams.map(stream => {
            return {
                stream,
                from_date: from_date_unix,
                poll_interval_sec: 1
            }
        });

        return callback(null, initialStates, 1);
    }

    pawsGetRegisterParameters(event, callback) {
        const regValues = {
            sophosSiemObjectNames: process.env.collector_streams
        };
        callback(null, regValues);
    }

    pawsGetLogs(state, callback) {
        let collector = this;
        // This code can remove once exsisting code set stream and collector_streams env variable
        if (!process.env.collector_streams) {
            collector.setCollectorStreamsEnv(process.env.paws_collector_param_string_1);
        }

        if (!state.stream) {
            state = collector.setStreamToCollectionState(state);
        }
        // If from date > 24 hr api return invalid request , so set the date between 24 hr only and report the skip duration on DD metrics
        if (moment().diff((moment.unix(parseInt(state.from_date))), 'hours') >= 24) {
            const previuosDate = state.from_date;
            state.from_date = moment().subtract(23.75, 'hours').unix();
            AlLogger.warn(`Adjusted date from  ${moment.unix(parseInt(previuosDate)).format("YYYY-MM-DDTHH:mm:ssZ")} to ${moment.unix(parseInt(state.from_date)).format("YYYY-MM-DDTHH:mm:ssZ")} as api require date must be within last 24 hours`);
            const skipDuration = moment.unix(parseInt(state.from_date)).diff(moment.unix(parseInt(previuosDate)), 'hours');
            if (skipDuration > 24) {
                collector.reportDDMetric("adjust_collection_interval", 1, [`skip_hrs:24h`]);
            }
            else {
                collector.reportDDMetric("adjust_collection_interval", 1, [`skip_hrs:${skipDuration}h`]);
            }
        }

        const APIHostName = collector.pawsDomainEndpoint;
        // TODO: Remove this isGatewayHostccondition once the new collectors are created and stable.
        const isGatewayHost = APIHostName && APIHostName.includes("/gateway");
        const clientSecret = collector.secret;
        if (!clientSecret) {
            return callback(isGatewayHost ? "The Authorization token was not found!" : "The Client Secret was not found!");
        }

        const clientId = collector.clientId;
        if (!clientId) {
            return callback(isGatewayHost ? "The x-api-key was not found!" : "The Client ID was not found!");
        }

        let messageString = state.nextPage ? collector.decodebase64string(state.nextPage) : `from ${moment.unix(parseInt(state.from_date)).format("YYYY-MM-DDTHH:mm:ssZ")}`;
        AlLogger.info(`SIEM000001 Collecting data for ${state.stream} ${messageString}`);
        // TODO: Remove this isGatewayHostccondition once the new collectors are created and stable.
        if (isGatewayHost) {
            const headers = {
                "x-api-key": clientId,
                Authorization: clientSecret
            };

            utils.getAPILogs(APIHostName, headers, state, [], process.env.paws_max_pages_per_invocation)
                .then(({ accumulator, nextPage, has_more }) => {
                    const newState = collector._getNextCollectionState(state, nextPage, has_more);
                    AlLogger.info(`SIEM000002 Next collection in ${newState.poll_interval_sec} seconds`);
                    return callback(null, accumulator, newState, newState.poll_interval_sec);
                })
                .catch((error) => collector.handleApiError(error, state, callback));
        } else {
            utils.authenticate(SOPHOS_AUTH_BASE_URL, clientId, clientSecret).then((token) => {
                utils.getTenantIdAndDataRegion(SOPHOS_API_BASE_URL, token).then((response) => {
                    if (!response.id) {
                        return callback("TenantId not found.");
                    }
                    let tenantId = response.id;
                    if (!response.apiHosts.dataRegion) {
                        return callback("Please generate credentials for the tenant. Currently, we do not support credentials for Organization and Partner.");
                    }
                    const apiHostsURL = response.apiHosts.dataRegion.replace(/^https:\/\/|\/$/g, "");
                    let headers = { "X-Tenant-ID": tenantId, Authorization: `Bearer ${token}`};
                    utils.getAPILogs(apiHostsURL, headers, state, [], process.env.paws_max_pages_per_invocation)
                        .then(({ accumulator, nextPage, has_more }) => {
                            const newState = collector._getNextCollectionState(state, nextPage, has_more);
                            AlLogger.info(`SIEM000002 Next collection in ${newState.poll_interval_sec} seconds`);
                            return callback(null, accumulator, newState, newState.poll_interval_sec);
                        })
                        .catch((error) => collector.handleApiError(error, state, callback));
                }).catch((error) => collector.handleErrors(error, callback));
            }).catch((error) => collector.handleAuthError(error, callback));
        }
    }

    handleApiError(error, state, callback) {
        if (error.response) {
            if (error.response.status === 401) {
                return callback({ message: "Invalid Credentials or Token expired or customer not authorized to make API call", errorCode: error.response.status });
            }
            if (error.response.status === 429) {
                state.poll_interval_sec = 900;
                AlLogger.info("API Request Limit Exceeded.");
                this.reportApiThrottling(() => callback(null, [], state, state.poll_interval_sec));
                return;
            }
            if (error.response.data) {
                error.response.data.errorCode = error.response.status;
                error.response.data.message = error.response.data.message || error.response.message || "";
                return callback(error.response.data);
            }
        }
        return callback(error);
    }

    handleErrors(error, callback) {
        if (error.response.data && !error.response.data.errorCode) {
            error.response.data.errorCode = error.response.status;
        }
        return callback(error.response.data);
    }

    handleAuthError(error, callback) {
        if (error.response && error.response.data) {
            const errorCode = error.response.data.errorCode;
            if (errorCode === "oauth.invalid_client_secret" || errorCode === "customer.validation") {
                error.response.data.message = `Error code [${error.response.status}]. Invalid client secret is provided.`;
            }
            if (errorCode === "oauth.client_app_does_not_exist") {
                error.response.data.message = `Error code [${error.response.status}]. Invalid client ID is provided.`;
            }
            return callback(error.response.data);
        }
        return callback({ errorCode: error.response && error.response.status, message: error.message || "Unknown authentication error" });
    }

    _getNextCollectionState(curState, nextPage, has_more) {
        let nextPollInterval;
        if (nextPage) {
            if (has_more) {
                nextPollInterval = 1;
            }
            else {
                nextPollInterval = this.pollInterval;
            }

            return {
                stream: curState.stream,
                nextPage: nextPage,
                poll_interval_sec: nextPollInterval
            };
        }
        else {
            // This condition works if next page getting null or undefined
            return {
                stream: curState.stream,
                from_date: moment().unix(),
                poll_interval_sec: 1
            };
        }
    }

    decodebase64string(nextPage) {

        const regex = /((-?(?:[1-9][0-9]*)?[0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(\.[0-9]+)?(Z))/g;
        let base64String = Buffer.from(nextPage, 'base64').toString('utf-8');
        const found = base64String.match(regex);
        let messageString = "";
        if (found) {
            messageString = found.length == 2 ? `from ${found[0]} till ${found[1]}` : `from ${found[0]}`;
        }

        return messageString;
    }

    pawsFormatLog(msg) {
        let collector = this;

        const ts = parse.getMsgTs(msg, tsPaths);
        const typeId = parse.getMsgTypeId(msg, typeIdPaths);

        let formattedMsg = {
            hostname: collector.collector_id,
            messageTs: ts.sec,
            priority: 11,
            progName: 'SophossiemCollector',
            message: JSON.stringify(msg),
            messageType: 'json/sophossiem',
            applicationId: collector.application_id
        };

        if (typeId !== null && typeId !== undefined) {
            formattedMsg.messageTypeId = `${typeId}`;
        }
        if (ts.usec) {
            formattedMsg.messageTsUs = ts.usec;
        }
        return formattedMsg;
    }

    setStreamToCollectionState(curState) {
        return {
            stream: curState.objectName,
            from_date: curState.from_date,
            poll_interval_sec: curState.poll_interval_sec
        };
    }
}

module.exports = {
    SophossiemCollector: SophossiemCollector
}
