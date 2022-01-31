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
const logging = require('@google-cloud/logging');
const packageJson = require('./package.json');

const API_THROTTLING_ERROR = 8;
const MAX_POLL_INTERVAL = 900;

const typeIdPaths = [
    {path: ['jsonPayload', 'fields', 'event_type', 'stringValue']},
    {path: ['protoPayload', 'type_url']},
    {path: ['payload']}
];

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
        // Start API client
        const client = new logging.v2.LoggingServiceV2Client({
            credentials: JSON.parse(collector.secret)
        });


        AlLogger.info(`GSTA000001 Collecting data from ${state.since} till ${state.until} for ${state.stream}`);

        // TODO: figure out a better way to format this. I'm pretty sure that it needs the newlines in it.
        const filter = `timestamp >= "${state.since}"
timestamp < "${state.until}"`;

        let pagesRetireved = 0;
        const options = {autoPaginate: false};

        const paginationCallback = (result, acc = []) => {
            AlLogger.info(`Getting page: ${pagesRetireved + 1} Logs retrieved: ${result[0].length}`);
            pagesRetireved++;
            const logs = result[0];
            const nextPage = result[1];
            const newAcc = [...acc, ...logs];
            AlLogger.info(`Total Logs ${newAcc.length}`);

            if(nextPage && pagesRetireved < process.env.paws_max_pages_per_invocation){

                return client.listLogEntries(nextPage, options)
                    .then(res => paginationCallback(res, newAcc));
            } else{
                return {logs: newAcc, nextPage};
            }
        };

        const pageSize = state.pageSize > 0 ? state.pageSize : 1000;
        let params = state.nextPage ?
            state.nextPage:
            {
                filter,
                pageSize: pageSize,
                resourceNames:[state.stream]
            };

        client.listLogEntries(params, options)
            .then(paginationCallback)
            .then(({logs, nextPage}) => {
                const newState = collector._getNextCollectionState(state, nextPage);
                AlLogger.info(`GSTA000002 Next collection in ${newState.poll_interval_sec} seconds`);

                return callback(null, logs, newState, newState.poll_interval_sec);
            })
            .catch(err => {
                AlLogger.error(`GSTA000003 err in collection ${err}`);

                // Stackdriver Logging api has some rate limits that we might run into.
                // If we run inot a rate limit error, instead of returning the error,
                // we return the state back to the queue with an additional second added, up to 15 min
                // https://cloud.google.com/logging/quotas
                // Error: 8 RESOURCE_EXHAUSTED: Received message larger than max (4518352 vs. 4194304),
                // so half the given interval and if interval is less than 15 sec then reduce the page size to half.

                if(err.code === API_THROTTLING_ERROR){
                    const interval = state.poll_interval_sec < 60 ? 60 : state.poll_interval_sec;
                    const nextPollInterval = state.poll_interval_sec < MAX_POLL_INTERVAL ?
                        interval + 60 : MAX_POLL_INTERVAL;
                    const currentInterval = moment(state.until).diff(state.since, 'seconds');
                    if (currentInterval <= 15 && err.details.includes('Received message larger than max')) {
                        // Reduce the page size to half to pull the data for throttling interval
                        if (state.nextPage && state.nextPage.pageSize) {
                            state.nextPage.pageSize = Math.ceil(state.nextPage.pageSize / 2);
                        }
                        else {
                            state.pageSize = Math.ceil(params.pageSize / 2)
                        }
                        AlLogger.warn(`RESOURCE_EXHAUSTED for ${currentInterval} sec time interval`);
                    }
                    else {
                        state.until = moment(state.since).add(Math.ceil(currentInterval / 2), 'seconds').toISOString();
                    }
                    const backOffState = Object.assign({}, state, {poll_interval_sec:nextPollInterval});
                    collector.reportApiThrottling(function () {
                        return callback(null, [], backOffState, nextPollInterval);
                    });
                }
                else {
                    // set errorCode if not available in error object to showcase client error on DDMetrics
                    if (err.code) {
                        err.errorCode = err.code;
                    }
                    return callback(err);
                }
            });
    }

    _getNextCollectionState(curState, nextPage) {
        // Reset the page size for next collection as log collection completed for throttling interval
        if (nextPage && nextPage.pageSize && nextPage.pageSize < 1000) {
            nextPage.pageSize = 1000;
        } else if (curState.pageSize && curState.pageSize < 1000) {
            curState.pageSize = 1000;
        }
        const {stream} = curState;

        const untilMoment = moment(curState.until);

        const { nextUntilMoment, nextSinceMoment, nextPollInterval } = calcNextCollectionInterval('day-week-progression', untilMoment, this.pollInterval);

        return  {
            since: nextSinceMoment.toISOString(),
            nextPage,
            stream,
            until: nextUntilMoment.toISOString(),
            poll_interval_sec: nextPollInterval
        };
    }

    // TODO: probably need to actually decode hte protobuf payload on these logs
    pawsFormatLog(msg) {
        let collector = this;

        const ts = msg.timestamp ? msg.timestamp : {seconds: Date.now() / 1000};

        const typeId = parse.getMsgTypeId(msg, typeIdPaths);

        let formattedMsg = {
            // TODO: figure out if this TS is always a string or if they API is goofy...
            messageTs: parseInt(ts.seconds),
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
