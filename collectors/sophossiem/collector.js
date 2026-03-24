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

    async pawsInitCollectionState(event) {
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
            };
        });

        return { state: initialStates, nextInvocationTimeout: 1 };
    }

    async pawsGetRegisterParameters(event) {
        return {
            sophosSiemObjectNames: process.env.collector_streams
        };
    }

    async pawsGetLogs(state) {
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
            throw new Error(isGatewayHost ? "The Authorization token was not found!" : "The Client Secret was not found!");
        }

        const clientId = collector.clientId;
        if (!clientId) {
            throw new Error(isGatewayHost ? "The x-api-key was not found!" : "The Client ID was not found!");
        }

        let messageString = state.nextPage ? collector.decodebase64string(state.nextPage) : `from ${moment.unix(parseInt(state.from_date)).format("YYYY-MM-DDTHH:mm:ssZ")}`;
        AlLogger.info(`SIEM000001 Collecting data for ${state.stream} ${messageString}`);

        // TODO: Remove this isGatewayHostccondition once the new collectors are created and stable.
        if (isGatewayHost) {
            const headers = {
                "x-api-key": clientId,
                Authorization: clientSecret
            };
            try {
                const { accumulator, nextPage, has_more } = await utils.getAPILogs(APIHostName, headers, state, [], process.env.paws_max_pages_per_invocation);
                const newState = collector._getNextCollectionState(state, nextPage, has_more);
                AlLogger.info(`SIEM000002 Next collection in ${newState.poll_interval_sec} seconds`);
                return [accumulator, newState, newState.poll_interval_sec];
            } catch (error) {
                return this._handleApiError(error, state);
            }
        } else {
            let token;
            try {
                token = await utils.authenticate(SOPHOS_AUTH_BASE_URL, clientId, clientSecret);
            } catch (error) {
                this._throwAuthError(error);
            }

            let response;
            try {
                response = await utils.getTenantIdAndDataRegion(SOPHOS_API_BASE_URL, token);
            } catch (error) {
                throw this.createErrorObject(error);
            }

            if (!response.id) {
                throw new Error("TenantId not found.");
            }
            if (!response.apiHosts.dataRegion) {
                throw new Error("Please generate credentials for the tenant. Currently, we do not support credentials for Organization and Partner.");
            }

            const tenantId = response.id;
            const apiHostsURL = response.apiHosts.dataRegion.replace(/^https:\/\/|\/$/g, "");
            const headers = { "X-Tenant-ID": tenantId, Authorization: `Bearer ${token}` };
            try {
                const { accumulator, nextPage, has_more } = await utils.getAPILogs(apiHostsURL, headers, state, [], process.env.paws_max_pages_per_invocation);
                const newState = collector._getNextCollectionState(state, nextPage, has_more);
                AlLogger.info(`SIEM000002 Next collection in ${newState.poll_interval_sec} seconds`);
                return [accumulator, newState, newState.poll_interval_sec];
            } catch (error) {
                return this._handleApiError(error, state);
            }
        }
    }

    createErrorObject(error) {
        const errorObject = {
            message: (error && error.message) || (error && error.response && error.response.data && error.response.data.message) || (error && error.response && error.response.message) || "Unknown error",
            errorCode: (error && error.errorCode) || (error && error.response && error.response.data && error.response.data.errorCode) || (error && error.response && error.response.status) || (error && error.code),
            status: (error && error.status) || (error && error.response && error.response.status),
            statusText: (error && error.statusText) || (error && error.response && error.response.statusText),
            code: error && error.code,
            errno: error && error.errno
        };
        return errorObject;
    }

    async _handleApiError(error, state) {
        if (error.response) {
            if (error.response.status === 401) {
                const errorObject = this.createErrorObject(error);
                errorObject.message = "Invalid Credentials or Token expired or customer not authorized to make API call";
                throw errorObject;
            }
            if (error.response.status === 429) {
                state.poll_interval_sec = 900;
                AlLogger.info("API Request Limit Exceeded.");
                await this.reportApiThrottling();
                return [[], state, state.poll_interval_sec];
            }
        }
        throw this.createErrorObject(error);
    }

    _throwAuthError(error) {
        const errorObject = this.createErrorObject(error);

        if (error && error.response && error.response.data) {
            const errorCode = error.response.data.errorCode;
            if (errorCode === "oauth.invalid_client_secret" || errorCode === "customer.validation") {
                errorObject.message = `Error code [${error.response.status}]. Invalid client secret is provided.`;
            }
            if (errorCode === "oauth.client_app_does_not_exist") {
                errorObject.message = `Error code [${error.response.status}]. Invalid client ID is provided.`;
            }
        } else if (!errorObject.message || errorObject.message === "Unknown error") {
            errorObject.message = "Unknown authentication error";
        }

        throw errorObject;
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
