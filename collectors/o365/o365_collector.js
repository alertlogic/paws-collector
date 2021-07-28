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
// Missing about 1 hours of historical logs shouldn't be too bad.
// If you get an error form the o365 managment api about your date range being more than 7 days in the past, you should remove some 9s from this number.
// Change the value from days to hours(6days 23hrs); subtracting value grater than 6.5 is actaully consider higer value 7.
const PARTIAL_WEEK_HOURS = 167; 

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
            startTs = moment().subtract(PARTIAL_WEEK_HOURS, 'hours').toISOString();
            console.info("O365000004 Start timestamp is more than 7 days in the past. This is not allowed in the MS managment API. setting the start time to 7 days in the past");
        }
        if (process.env.paws_collection_interval && process.env.paws_collection_interval > 0) {
            endTs = moment(startTs).add(process.env.paws_collection_interval, 'seconds').toISOString();
        }
        else if (moment().diff(startTs, 'hours') > 1) {
            endTs = moment(startTs).add(1, 'hours').toISOString();
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
            const { nextUntilMoment, nextSinceMoment, nextPollInterval } = calcNextCollectionInterval('hour-cap', moment(), this.pollInterval);
            state.since = nextSinceMoment.toISOString();
            state.until = nextUntilMoment.toISOString();
            state.nextPage = null;
            state.poll_interval_sec = nextPollInterval;
            return callback(null, [], state, state.poll_interval_sec);
        }

        console.info(`O365000001 Collecting data from ${state.since} till ${state.until} for stream ${state.stream}`);

        if(moment().diff(state.since, 'days', true) > 7){
            const newStart = moment().subtract(PARTIAL_WEEK_HOURS, 'hours');
            state.since = newStart.toISOString();
            state.until = (process.env.paws_collection_interval && process.env.paws_collection_interval > 0) ? newStart.add(process.env.paws_collection_interval, 'seconds').toISOString() : newStart.add(1, 'hours').toISOString();
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
            // set errorCode to showcase client error on DDMetric
            if (typeof err === 'object') {
                err.errorCode = err.code ? err.code : (err.statusCode ? err.statusCode : err.status);
            }
            let newState = this._handleMSManagementApiError(err, state);
            if (newState) {
                return callback(null, [], newState, newState.poll_interval_sec);
            }
 
            if (!err.code && err.message) {
              const formatedError = this._formatErrorMessage(err);
              console.error(`O365000003 Error in collection: ${err.message}`);
              return callback(formatedError);
            } else {
                // if error is string or don't have err.code  in error object, then return complete error object/string.
                return callback(err);
            }
        });
    }

    _getNextCollectionState(curState) {
        const untilMoment = moment(curState.until);

        const { nextUntilMoment, nextSinceMoment, nextPollInterval } = (process.env.paws_collection_interval && process.env.paws_collection_interval > 0) ? this.calcNextCustomCollectionInterval(process.env.paws_collection_interval, untilMoment, this.pollInterval)
            : calcNextCollectionInterval('hour-cap', untilMoment, this.pollInterval);

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

    /**
     * 1.Expired content error can be occur when start date is older than 7day and we reset the date to last 7days
     * If data for 1st 1hr is huge and within time it will not able to pull the data from array of contentUri using asyncPool;
     * Then set the satrt time to 15 min later,in this case we loss the data for 15 min but will resolve the issue and get remaining data without any error
     * @param {*} err 
     * @param {*} state
     * @returns 
     */
    _handleMSManagementApiError(err, state) {
        if (err.response && err.response.body) {
            const responseBody = JSON.parse(err.response.body);
            const contentExpireErrorCode = responseBody.error.code;
            if (contentExpireErrorCode === 'AF20051') {
                const currentInterval = moment(state.until).diff(state.since, 'minutes');
                const newStart = moment(state.since).add(15, 'minutes');
                state.since = newStart.toISOString();
                state.until = moment(newStart).add(currentInterval, 'minutes').toISOString();
                state.poll_interval_sec = 1;
                console.warn(`Now collecting data from ${state.since} to ${state.until} to handle Expired content in older than 7 days`);
                return state;
            }
            return null;
        }
        return null;
    }

    /**
     * Format the error message to user understandable message
     * @param {*} err 
     * @returns 
     */
    _formatErrorMessage(err) {
        const message = err.message;
        // set errorCode if not available in error object to showcase client error on DDMetric
        try {
            const error = JSON.parse(message.slice(message.indexOf('{'), message.lastIndexOf('}') + 1));
            err.errorCode = error.error ? error.error : error.error_codes[0];
            if (error.error_codes) {
                if (error.error_codes[0] === 7000215) {
                    err.message = 'Error code [7000215]. Invalid client secret is provided.';
                }
                if (error.error_codes[0] === 700016) {
                    err.message = 'Error code [700016]. Invalid client ID is provided.';
                }
                if (error.error_codes[0] === 90002) {
                    err.message = 'Error code [90002]. Please make sure you have the correct tenant ID or this may happen if there are no active subscriptions for the tenant. Check with your subscription administrator.';
                } 
            }
            return err;
        } catch (exception) {
            return err;
        }
    }

    calcNextCustomCollectionInterval(pawsCollectionInterval, curUntilMoment, pollInterval) {
        const nowMoment = moment();
        const nextSinceMoment = curUntilMoment.isAfter(nowMoment) ? nowMoment : curUntilMoment;
        let nextUntilMoment;

        if (nowMoment.diff(nextSinceMoment, 'hours') > 1) {
            nextUntilMoment = moment(nextSinceMoment).add(pawsCollectionInterval, 'seconds');
        }
        else {
            nextUntilMoment = moment(nextSinceMoment).add(pollInterval, 'seconds');
        }
        const nextPollInterval = nowMoment.diff(nextUntilMoment, 'seconds') > pollInterval ?
            1 : pollInterval;
        return { nextSinceMoment, nextUntilMoment, nextPollInterval };
    }
}

module.exports = {
    O365Collector: O365Collector
}
