/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * googlestackdriver class.
 *
 * @end
 * -----------------------------------------------------------------------------
 */
'use strict';

const moment = require('moment');
const PawsCollector = require('@alertlogic/paws-collector').PawsCollector;
const calcNextCollectionInterval = require('@alertlogic/paws-collector').calcNextCollectionInterval;
const parse = require('@alertlogic/al-collector-js').Parse;
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;
const packageJson = require('./package.json');
const { auth } = require("google-auth-library");
const { google } = require("googleapis");

const API_THROTTLING_ERROR = 8;
const API_THROTTLING_STATUS_CODE = 429;
const MAX_POLL_INTERVAL = 900;
const MAX_PAGE_SIZE = 1000;
const SCOPES = [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/cloud-platform.read-only',
    'https://www.googleapis.com/auth/logging.admin',
    'https://www.googleapis.com/auth/logging.read',
    'https://www.googleapis.com/auth/logging.write',
];

const typeIdPaths = [
    {path: ['jsonPayload']},
    {path: ['protoPayload', '@type']},
    {path: ['payload']}
];

const tsPaths = [{ path: ["timestamp"] }];

class GooglestackdriverCollector extends PawsCollector {

    constructor(context, creds){
        super(context, creds, packageJson.version);
    }

    
    pawsInitCollectionState(event, callback) {
        const startTs = process.env.paws_collection_start_ts ?
                process.env.paws_collection_start_ts :
                    moment().toISOString();
        let endTs;

        if(moment().diff(startTs, 'days') > 7){
            endTs = moment(startTs).add(7, 'days').toISOString();
        }
        else if(moment().diff(startTs, 'hours') > 24){
            endTs = moment(startTs).add(24, 'hours').toISOString();
        }
        else {
            endTs = moment(startTs).add(this.pollInterval, 'seconds').toISOString();
        }
        const resourceNames = JSON.parse(process.env.collector_streams);
        const initialStates = resourceNames.map(stream => ({
            stream,
            nextPage:null,
            since: startTs,
            until: endTs,
            poll_interval_sec: 1
        }));
        return callback(null, initialStates, 1);
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
        const keysEnvVar = collector.secret;
        if (!keysEnvVar) {
            throw new Error("The $CREDS environment variable was not found!");
        }
        // Start API client
        const keys = JSON.parse(keysEnvVar);
        const client = auth.fromJSON(keys);
        client.subject = collector.clientId;
        client.scopes = SCOPES;
        const logging = google.logging({
            version: 'v2',
            auth: client,
        });


        AlLogger.info(`GSTA000001 Collecting data from ${state.since} till ${state.until} for ${state.stream}`);

        // TODO: figure out a better way to format this. I'm pretty sure that it needs the newlines in it.
        const filter = `timestamp >= "${state.since}"
timestamp < "${state.until}"`;

        let pagesRetireved = 0;
       
        const paginationCallback = (result, acc = []) => {
            let logs = result.data.entries || [];
            AlLogger.info(`Getting page: ${pagesRetireved + 1} Logs retrieved: ${logs.length}`);
            pagesRetireved++;
            const nextPageToken = result.data && result.data.nextPageToken ? result.data.nextPageToken : null;
            let nextPage;
            if (nextPageToken) {
                nextPage = { ...params, filter: filter, pageToken: nextPageToken };
            } 
            const newAcc = [...acc, ...logs];
            AlLogger.info(`Total Logs ${newAcc.length}`);
            if (nextPage && nextPage.pageToken && pagesRetireved < process.env.paws_max_pages_per_invocation) {
                return logging.entries.list(nextPage)
                    .then(res => {
                        return paginationCallback(res, newAcc)
                    });
            } else {
                return { logs: newAcc, nextPage };
            }
        };

        const pageSize = state.pageSize > 0 ? state.pageSize : MAX_PAGE_SIZE;
        let params = state.nextPage && state.nextPage.pageToken ?
            state.nextPage :
            {
                filter,
                pageSize: pageSize,
                resourceNames: [state.stream]
            };

        logging.entries.list(params)
            .then(paginationCallback)
            .then(({ logs, nextPage }) => {
                const newState = collector._getNextCollectionState(state, nextPage);
                AlLogger.debug(`GSTA000012 NextCollectionState ${JSON.stringify(newState)}`);
                AlLogger.info(`GSTA000002 Next collection in ${newState.poll_interval_sec} seconds`);
                return callback(null, logs, newState, newState.poll_interval_sec);
            })
            .catch(err => {
                    AlLogger.error(`GSTA000003 err in collection ${JSON.stringify(err)}`);
                // Stackdriver Logging api has some rate limits that we might run into.
                // If we run inot a rate limit error, instead of returning the error,
                // we return the state back to the queue with an additional second added, up to 15 min
                // https://cloud.google.com/logging/quotas
                // Error: 8 RESOURCE_EXHAUSTED: Received message larger than max (4518352 vs. 4194304),
                // so half the given interval and if interval is less than 15 sec then reduce the page size to half.

                if (err.code === API_THROTTLING_ERROR || (err.response && err.response.status === API_THROTTLING_STATUS_CODE)) {
                    const currentInterval = moment(state.until).diff(state.since, 'seconds');
                    const interval = state.poll_interval_sec < 60 ? 60 : state.poll_interval_sec;
                    const nextPollInterval = state.poll_interval_sec < MAX_POLL_INTERVAL ?
                        interval + 60 : MAX_POLL_INTERVAL;
                    if (state.nextPage && state.nextPage.pageToken && state.nextPage.pageSize) {
                        state.nextPage.pageSize = Math.ceil(state.nextPage.pageSize / 2);
                        AlLogger.debug(`Throttling error with nextPage: ${err.message}. Retrying with smaller pageSize.`);
                    } else {
                        if (currentInterval <= 15 && err.message && err.message.indexOf('Received message larger than max') >= 0) {
                            state.pageSize = state.pageSize ? Math.ceil(state.pageSize / 2) : Math.ceil(params.pageSize / 2);
                            AlLogger.debug(`Throttling error with no nextPage and large message: ${err.message}. Reducing pageSize.`);
                        } else {
                            state.until = moment(state.since).add(Math.ceil(currentInterval / 2), 'seconds').toISOString();
                            AlLogger.debug(`Throttling error with no nextPage: ${err.message}. Reducing time range.`);
                        }
                    }
                    const backOffState = Object.assign({}, state, { poll_interval_sec: nextPollInterval });
                    collector.reportApiThrottling(function () {
                        return callback(null, [], backOffState, nextPollInterval);
                    });
                } else {
                    // set errorCode if not available in error object to showcase client error on DDMetrics
                    if (err.code) {
                        err.errorCode = err.code;
                    }
                    return callback(err);
                }
            });
    }


    _getNextCollectionState(curState, nextPage) {
        // Reset the page size for the next collection if it's less than the maximum
        const pageSize = Math.max(MAX_PAGE_SIZE, nextPage?.pageSize || curState.pageSize || MAX_PAGE_SIZE);

        const { stream, since, until } = curState;

        if (nextPage && nextPage.pageToken) {
            // Case: Continue with the next page
            return {
                since,
                nextPage: { ...nextPage, pageSize },
                stream,
                until,
                poll_interval_sec: 1
            };
        } else {
            // Case: Start a new collection
            const untilMoment = moment(curState.until);

            const { nextUntilMoment, nextSinceMoment, nextPollInterval } = calcNextCollectionInterval('day-week-progression', untilMoment, this.pollInterval);

            return {
                since: nextSinceMoment.toISOString(),
                nextPage,
                stream,
                until: nextUntilMoment.toISOString(),
                poll_interval_sec: nextPollInterval
            };
        }
    }

    // TODO: probably need to actually decode hte protobuf payload on these logs
    pawsFormatLog(msg) {
        let collector = this;
        const ts = parse.getMsgTs(msg, tsPaths);

        const typeId = parse.getMsgTypeId(msg, typeIdPaths);

        let formattedMsg = {
            // TODO: figure out if this TS is always a string or if they API is goofy...
            hostname: collector.collector_id,
            messageTs: ts.sec,
            priority: 11,
            progName: 'GooglestackdriverCollector',
            message: JSON.stringify(msg),
            messageType: 'json/googlestackdriver',
            applicationId: collector.application_id

        };

        if (typeId !== null && typeId !== undefined) {
            formattedMsg.messageTypeId = `${typeId}`;
        }
        if (ts.nanos) {
            formattedMsg.messageTsUs = ts.nanos;
        }
        return formattedMsg;
    }

    setStreamToCollectionState(curState) {
        return {
            stream: curState.resource,
            since: curState.since,
            until: curState.until,
            nextPage: curState.nextPage,
            poll_interval_sec: curState.poll_interval_sec
        };
    }
}

module.exports = {
    GooglestackdriverCollector: GooglestackdriverCollector
}
