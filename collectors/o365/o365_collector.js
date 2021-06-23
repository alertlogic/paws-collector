/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * o365 class.
 *
 * @end
 * -----------------------------------------------------------------------------
 */
'use strict';

const moment = require('moment');
const PawsCollector = require('@alertlogic/paws-collector').PawsCollector;
const calcNextCollectionInterval = require('@alertlogic/paws-collector').calcNextCollectionInterval;
const m_o365mgmnt = require('./lib/o365_mgmnt');
const { checkO365Subscriptions } = require('./healthcheck');
const packageJson = require('./package.json');

const parse = require('@alertlogic/al-collector-js').Parse;
const asyncPool = require("tiny-async-pool");

// Subtracting less than 7 days to avoid weird race conditions with the azure api...
// Missing about 2 hours of historical logs shouldn't be too bad.
// If you get an error form the o365 managment api about your date range being more than 7 days in the past, you should remove some 9s from this number.
const PARTIAL_WEEK = 6.99;

const typeIdPaths = [
    { path: ['RecordType'] }
];

const tsPaths = [
    { path: ['CreationTime'] }
];

class O365Collector extends PawsCollector {

    constructor(context, creds) {
        super(context, creds, packageJson.version, [checkO365Subscriptions], []);
    }
    
    pawsInitCollectionState(event, callback) {
        let startTs = process.env.paws_collection_start_ts ?
                process.env.paws_collection_start_ts :
                    moment().toISOString();
        let endTs;

        if(moment().diff(startTs, 'days') > 7){
            startTs = moment().subtract(PARTIAL_WEEK, 'days').toISOString();
            console.info("O365000004 Start timestamp is more than 7 days in the past. This is not allowed in the MS managment API. setting the start time to 7 days in the past");
        }

        if(moment().diff(startTs, 'hours') > 24){
            endTs = moment(startTs).add(3, 'hours').toISOString();
        }
        else {
            endTs = moment(startTs).add(this.pollInterval, 'seconds').toISOString();
        }

        // Create a new
        const streams = JSON.parse(process.env.collector_streams);
        const initialStates = streams.map(stream => {
            return {
                stream,
                since: startTs,
                until: endTs,
                nextPage: null,
                poll_interval_sec: 1
            }
        });

        return checkO365Subscriptions((err) => {
            return callback(err, initialStates, 1);
        });
    }

    pawsGetRegisterParameters(event, callback){
        const regValues = {
            azureTenantId: process.env.paws_collector_param_string_1,
            azureStreams: process.env.collector_streams
        };

        callback(null, regValues);
    }

    pawsGetLogs(state, callback) {
        let collector = this;
        // This code can remove once exsisting code set collector_streams env variable
        if (!process.env.collector_streams) {
            collector.setCollectorStreamsEnv(process.env.paws_collector_param_string_2);
        }

        if (!moment(state.since).isValid() || !moment(state.until).isValid() || state.since === undefined || state.until === undefined) {
            const { nextUntilMoment, nextSinceMoment, nextPollInterval } = calcNextCollectionInterval('hour-day-progression', moment(), this.pollInterval);
            state.since = nextSinceMoment.toISOString();
            state.until = nextUntilMoment.toISOString();
            state.nextPage = null;
            state.poll_interval_sec = nextPollInterval;
            return callback(null, [], state, state.poll_interval_sec);
        }

        console.info(`O365000001 Collecting data from ${state.since} till ${state.until} for stream ${state.stream}`);

        if(moment().diff(state.since, 'days', true) > 7){
            const newStart = moment().subtract(PARTIAL_WEEK, 'days');
            state.since = newStart.toISOString();
            state.until = newStart.add(15, 'minutes').toISOString();
            // remove next page token if the state is out of date as well.
            state.nextPage = null;
            console.warn(
                "O365000005 Start timestamp is more than 7 days in the past. ",
                "This is not allowed in the MS managment API. ",
                "Setting the start time to 7 days in the past. ",
                `Now collecting data from ${state.since} till ${state.until} for stream ${state.stream}`
            );
        }

        let pageCount = 0;

        // Page aggregation handler
        const listContentCallback = ({parsedBody, nextPageUri}) => {

            if(nextPageUri && pageCount < process.env.paws_max_pages_per_invocation){
                pageCount++;
                return m_o365mgmnt.getPreFormedUrl(nextPageUri)
                    .then((nextPageRes) => {
                        return {
                            parsedBody: [...parsedBody, ...nextPageRes.parsedBody],
                            nextPageUri: nextPageRes.nextPageUri
                        }
                    })
                    .then(listContentCallback);
            }
            else{
                return {
                    parsedBody,
                    nextPageUri
                }
            }
        };

        // If the state has a next page value, then just start with that.
        const initialListContent = state.nextPage ?
            m_o365mgmnt.getPreFormedUrl(state.nextPage):
            m_o365mgmnt.subscriptionsContent(state.stream, state.since, state.until);

        // Call out to get content pages and form result
        const contentPromise = initialListContent.then(listContentCallback)
            .then(({parsedBody, nextPageUri}) => {
                const contentUriFun = ({contentUri}) => m_o365mgmnt.getPreFormedUrl(contentUri);
                const poolLimit = 20;

                return asyncPool(poolLimit, parsedBody, contentUriFun).then(content => {
                    return {
                        logs: content.reduce((agg, {parsedBody}) => [...parsedBody, ...agg], []),
                        nextPage: nextPageUri
                    };
                });
            });

        // Now that we have all the content uri promises agregated, we can call them and collect the data
        contentPromise.then(({logs, nextPage}) => {
            let newState;
            if(nextPage === undefined){
                newState = this._getNextCollectionState(state);
            } else {
                newState = this._getNextCollectionStateWithNextPage(state, nextPage);
            }

            return callback(null, logs, newState, newState.poll_interval_sec);
        }).catch(err => {
            if (err.message) {
                let message = err.message;
                // set errorCode if not available in error object to showcase client error on DDMetric
                try {
                    let error = JSON.parse(message.slice(message.indexOf('{'), message.lastIndexOf('}') + 1));
                    err.errorCode = error.error;
                    if (error.error_codes) {
                        if (error.error_codes[0] === 7000215) {
                            return callback("Error code [7000215]. Invalid client secret is provided.");
                        }
                        if (error.error_codes[0] === 700016) {
                            return callback("Error code [700016]. Invalid client ID is provided.");
                        }
                        if (error.error_codes[0] === 90002) {
                            return callback("Error code [90002]. Please make sure you have the correct tenant ID or this may happen if there are no active subscriptions for the tenant. Check with your subscription administrator.");
                        }
                    } 
                } catch (exception) {
                    return callback(err);
                }
            }
            console.error(`O365000003 Error in collection: ${err.message}`);
            return callback(err);
        })

    }

    _getNextCollectionState(curState) {
        const untilMoment = moment(curState.until);

        const { nextUntilMoment, nextSinceMoment, nextPollInterval } = calcNextCollectionInterval('hour-day-progression', untilMoment, this.pollInterval);

        return  {
            stream: curState.stream,
            since: nextSinceMoment.toISOString(),
            until: nextUntilMoment.toISOString(),
            poll_interval_sec: nextPollInterval
        };
    }

    _getNextCollectionStateWithNextPage({stream, since, until}, nextPage) {
        return {
            stream,
            since,
            until,
            nextPage,
            poll_interval_sec: 1
        }
    }

    pawsFormatLog(msg) {
        let collector = this;

        const ts = parse.getMsgTs(msg, tsPaths);
        const typeId = parse.getMsgTypeId(msg, typeIdPaths);

        let formattedMsg = {
            messageTs: ts.sec,
            priority: 11,
            progName: 'O365Collector',
            message: JSON.stringify(msg),
            messageType: 'json/azure.o365',
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
    O365Collector: O365Collector
}
