/* -----------------------------------------------------------------------------
 * @copyright (C) 2020, Alert Logic, Inc
 * @doc
 *
 * sophos class.
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
const calcNextCollectionInterval = require('@alertlogic/paws-collector').calcNextCollectionInterval;

const typeIdPaths = [{ path: ['id'] }];

const tsPaths = [{ path: ["raisedAt"] }];

//Sophos base endpoints. These appear to be universal per the docs
const SOPHOS_AUTH_BASE_URL = "id.sophos.com";
const SOPHOS_API_BASE_URL = "api.central.sophos.com";

class SophosCollector extends PawsCollector {
    constructor(context, creds) {
        super(context, creds, packageJson.version);
    }

    async pawsInitCollectionState(event) {
        const startTs = process.env.paws_collection_start_ts ?
            process.env.paws_collection_start_ts :
            moment().toISOString();
        const endTs = moment(startTs).add(this.pollInterval, 'seconds').toISOString();
        const initialState = {
            since: startTs,
            until: endTs,
            nextPage: null,
            apiQuotaResetDate: null,
            poll_interval_sec: 1
        };
        return { state: initialState, nextInvocationTimeout: 1 };
    }

    async pawsGetLogs(state) {
        let collector = this;

        const clientSecret = collector.secret;
        if (!clientSecret) {
            throw new Error("The Client Secret was not found!");
        }
        const clientId = collector.clientId;
        if (!clientId) {
            throw new Error("The Client ID was not found!");
        }

        AlLogger.info(`SOPH000001 Collecting data from ${state.since} till ${state.until}`);

        if (state.apiQuotaResetDate && moment().isBefore(state.apiQuotaResetDate)) {
            AlLogger.info(`API Request Limit Exceeded. The quota will be reset at ${state.apiQuotaResetDate}`);
            await collector.reportApiThrottling();
            return [[], state, state.poll_interval_sec];
        }
        let token;
        try {
            token = await utils.authenticate(SOPHOS_AUTH_BASE_URL, clientId, clientSecret);
        } catch (error) {
            const errorObject = collector.createErrorObject(error);

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

        let tenantResponse;
        try {
            // while runing on live api server pass getTenantIdAndDataRegion hostname value "api.central.sophos.com"
            tenantResponse = await utils.getTenantIdAndDataRegion(SOPHOS_API_BASE_URL, token);
        } catch (error) {
            throw collector.createErrorObject(error);
        }

        if (!(tenantResponse && tenantResponse.apiHosts && tenantResponse.apiHosts.dataRegion)) {
            throw new Error("Please generate credentials for the tenant. Currently we do not support credentials for Organization and Partner.");
        }

        const apiHostsURL = tenantResponse.apiHosts.dataRegion.replace(/^https:\/\/|\/$/g, '');

        try {
            const { accumulator, nextPage } = await utils.getAPILogs(
                apiHostsURL,
                token,
                tenantResponse.id,
                state,
                [],
                process.env.paws_max_pages_per_invocation
            );

            let newState;
            if (nextPage === undefined) {
                newState = this._getNextCollectionState(state);
            } else {
                newState = this._getNextCollectionStateWithNextPage(state, nextPage);
            }
            AlLogger.info(`SOPH000002 Next collection in ${newState.poll_interval_sec} seconds`);
            return [accumulator, newState, newState.poll_interval_sec];
        } catch (error) {
            if ((error.response && error.response.data && error.response.data.errorCode === "TooManyRequests") || (error.response && error.response.status === 429)) {
                state.apiQuotaResetDate = moment().add(1, "hours").toISOString();
                state.poll_interval_sec = 900;
                AlLogger.info(`API Request Limit Exceeded. The quota will be reset at ${state.apiQuotaResetDate}`);
                await collector.reportApiThrottling();
                return [[], state, state.poll_interval_sec];
            }
            throw collector.createErrorObject(error);
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

    _getNextCollectionState(curState) {

        const untilMoment = moment(curState.until);

        const { nextUntilMoment, nextSinceMoment, nextPollInterval } = calcNextCollectionInterval('hour-cap', untilMoment, this.pollInterval);

        return {
            since: nextSinceMoment.toISOString(),
            until: nextUntilMoment.toISOString(),
            nextPage: null,
            apiQuotaResetDate: null,
            poll_interval_sec: nextPollInterval
        };
    }

    _getNextCollectionStateWithNextPage({ since, until }, nextPage) {
        return {
            since,
            until,
            nextPage,
            apiQuotaResetDate: null,
            poll_interval_sec: 1
        };
    }

    pawsFormatLog(msg) {
        let collector = this;

        const ts = parse.getMsgTs(msg, tsPaths);
        const typeId = parse.getMsgTypeId(msg, typeIdPaths);

        let formattedMsg = {
            hostname: collector.collector_id,
            messageTs: ts.sec,
            priority: 11,
            progName: 'SophosCollector',
            message: JSON.stringify(msg),
            messageType: 'json/sophos',
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
}

module.exports = {
    SophosCollector: SophosCollector
};
