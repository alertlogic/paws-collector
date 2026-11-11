/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * Auth0 collector class.
 *
 * @end
 * -----------------------------------------------------------------------------
 */
'use strict';

const moment = require('moment');
const parse = require('@alertlogic/al-collector-js').Parse;
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;
const ManagementClient = require('auth0').ManagementClient;
const PawsCollector = require('@alertlogic/paws-collector').PawsCollector;
const packageJson = require('./package.json');
const utils = require("./utils");

const typeIdPaths = [
    { path: ['type'] }
];

const tsPaths = [
    { path: ['date'] }
];

const HOSTNAME_REGEXP = /^[htps]*:\/\/|\/$/gi;
const API_THROTTLING_ERROR = 429;

// Module-scoped Lambda invocations reuse one client and its token cache.
let cachedAuth0Client = null;
let cachedAuth0ClientKey = null;
let getAuth0ClientCallCount = 0;
let auth0ClientCreateCount = 0;

function getAuth0Client(domain, clientId, clientSecret) {
    getAuth0ClientCallCount += 1;
    const cacheKey = `${domain}\0${clientId}\0${clientSecret}`;
    if (cachedAuth0Client && cachedAuth0ClientKey === cacheKey) {
        AlLogger.debug(`AUTZ000004 getAuth0Client cache hit (calls=${getAuth0ClientCallCount}, creates=${auth0ClientCreateCount})`);
        return cachedAuth0Client;
    }
    auth0ClientCreateCount += 1;
    AlLogger.debug(`AUTZ000004 getAuth0Client cache miss creating ManagementClient (calls=${getAuth0ClientCallCount}, creates=${auth0ClientCreateCount})`);
    cachedAuth0Client = new ManagementClient({
        domain,
        clientId,
        clientSecret,
        scope: 'read:logs',
        tokenProvider: { enableCache: true }
    });
    cachedAuth0ClientKey = cacheKey;
    return cachedAuth0Client;
}

class Auth0Collector extends PawsCollector {

    constructor(context, creds) {
        super(context, creds, packageJson.version);
    }
    
    async pawsInitCollectionState(event) {
        const initialState = {
            since: process.env.paws_collection_start_ts ? process.env.paws_collection_start_ts : moment().subtract(5, 'minutes').toISOString(),
            poll_interval_sec: 1
        };
        return { state: initialState, nextInvocationTimeout: 1 };
    }

    async pawsGetLogs(state) {
        let collector = this;
        const hostname = collector.pawsDomainEndpoint;
        const auth0Client = getAuth0Client(hostname, collector.clientId, collector.secret);
        return utils.getAPILogs(auth0Client, state, [], process.env.paws_max_pages_per_invocation)
            .then(({ accumulator, nextLogId, lastLogTs }) => {
                const newState = collector._getNextCollectionState(state, nextLogId, lastLogTs);
                AlLogger.info(`AUTZ000002 Next collection in ${newState.poll_interval_sec} seconds`);
                return [accumulator, newState, newState.poll_interval_sec];
            }).catch(async (error) => {
                // Auth0 Logging api has some rate limits that we might run into.
                // If we run into a rate limit error, instead of returning the error,
                // we return the state back to the queue with an additional 10 second added.
                // https://auth0.com/docs/support/policies/rate-limit-policy/management-api-endpoint-rate-limits
                // Rate Limit GET /api/v2/logs 10 call per sec
                if (error.statusCode && error.statusCode === API_THROTTLING_ERROR) {
                    state.poll_interval_sec = state.poll_interval_sec < 10 ?
                        10 : state.poll_interval_sec + 1;
                    AlLogger.warn(`AUTZ000003 API Request Limit Exceeded`, error);
                    await collector.reportApiThrottling();
                    return [[], state, state.poll_interval_sec];
                }
                else {
                    throw collector.createErrorObject(error);
                }
            });
    }

    createErrorObject(error) {
        const errorObject = {
            message: error.message || (error.response && error.response.data && error.response.data.message) || (error.response && error.response.message) || "Unknown error",
            errorCode: error.errorCode || (error.response && error.response.data && error.response.data.errorCode) || (error.response && error.response.status) || error.code || error.statusCode,
            status: error.status || (error.response && error.response.status) || error.statusCode,
            statusText: error.statusText || (error.response && error.response.statusText),
            code: error.code,
            errno: error.errno
        };
        return errorObject;
    }

    _getNextCollectionState(curState, nextLogId, lastLogTs) {
        const nowMoment = moment();
        const lastLogMoment = moment(lastLogTs);

        // Check if we're behind collection schedule and need to catch up.
        const nextPollInterval = nowMoment.diff(lastLogMoment, 'seconds') > this.pollInterval ?
                1 : this.pollInterval;

        if (nextLogId === null) {
            // If collector initial call and get empty logs then this condition will work
            const lastTs = lastLogTs ? lastLogTs : curState.since;
            return {
                since: lastTs,
                poll_interval_sec: 1
            };
        }

        return {
            last_log_id: nextLogId,
            last_collected_ts: lastLogTs,
            poll_interval_sec: nextPollInterval
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
            progName: 'Auth0Collector',
            message: JSON.stringify(msg),
            messageType: 'json/auth0',
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
    Auth0Collector: Auth0Collector
};
