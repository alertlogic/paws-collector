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
const request = require('request');
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

class Auth0Collector extends PawsCollector {

    constructor(context, creds) {
        super(context, creds, packageJson.version);
    }
    
    pawsInitCollectionState(event, callback) {
        const initialState = {
            since: process.env.paws_collection_start_ts ? process.env.paws_collection_start_ts : moment().subtract(5, 'minutes').toISOString(),
            poll_interval_sec: 1
        };
        return callback(null, initialState, 1);
    }

    pawsGetLogs(state, callback) {
        let collector = this;
        const hostname = collector.pawsDomainEndpoint;
        const auth0Client = new ManagementClient({
            domain: hostname,
            clientId: collector.clientId,
            clientSecret: collector.secret,
            scope: 'read:logs'
        });
        utils.getAPILogs(auth0Client, state, [], process.env.paws_max_pages_per_invocation)
            .then(({ accumulator, nextLogId, lastLogTs }) => {
                const newState = collector._getNextCollectionState(state, nextLogId, lastLogTs);
                AlLogger.info(`AUTZ000002 Next collection in ${newState.poll_interval_sec} seconds`);
                return callback(null, accumulator, newState, newState.poll_interval_sec);
            }).catch((error) => {
                // Auth0 Logging api has some rate limits that we might run into.
                // If we run into a rate limit error, instead of returning the error,
                // we return the state back to the queue with an additional 10 second added.
                // https://auth0.com/docs/support/policies/rate-limit-policy/management-api-endpoint-rate-limits
                // Rate Limit GET /api/v2/logs 10 call per sec
                if (error.statusCode && error.statusCode === API_THROTTLING_ERROR) {
                    state.poll_interval_sec = state.poll_interval_sec < 10 ?
                        10 : state.poll_interval_sec + 1;
                    collector.reportApiThrottling(function () {
                        return callback(null, [], state, state.poll_interval_sec);
                    });
                }
                else {
                    // set error code for DDMetrics
                    error.errorCode = error.statusCode;
                    return callback(error);
                }
            });
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
}
