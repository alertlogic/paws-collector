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

// Subtracting less than 7 days to avoid weird race conditions with the azure api...
// Missing about 9 seconds of historical logs shouldn't be too bad.
// If you get an error form the o365 managment api about your date range being more than 7 days in the past, you should remove some 9s from this number.
const PARTIAL_WEEK = 6.9999;

const typeIdPaths = [
   { path: ['CreationTime'] }
];

const tsPaths = [
    { path: ['RecordType'] }
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
            endTs = moment(startTs).add(24, 'hours').toISOString();
        }
        else {
            endTs = moment(startTs).add(this.pollInterval, 'seconds').toISOString();
        }

        // Create a new
        const streams = JSON.parse(process.env.paws_collector_param_string_2);
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
            azureStreams: process.env.paws_collector_param_string_2
        };

        callback(null, regValues);
    }

    pawsGetLogs(state, callback) {
        let collector = this;
        console.info(`O365000001 Collecting data from ${state.since} till ${state.until} for stream ${state.stream}`);
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
                const contentUriPromises = parsedBody.map(({contentUri}) => m_o365mgmnt.getPreFormedUrl(contentUri));

                return Promise.all(contentUriPromises).then(content => {
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
    O365Collector: O365Collector
}
