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
const m_o365mgmnt = require('./lib/o365_mgmnt');

const parse = require('@alertlogic/al-collector-js').Parse;


const typeIdPaths = [
   { path: ['CreationTime'] }
];

const tsPaths = [
    { path: ['RecordType'] }
];

console.log(process.env.O365_CONTENT_STREAMS)
class O365Collector extends PawsCollector {
    constructor(context, creds) {
        super(context, creds, 'o365');
    }
    
    pawsInitCollectionState(event, callback) {
        const startTs = process.env.paws_collection_start_ts ? 
                process.env.paws_collection_start_ts :
                    moment().toISOString();
        const endTs = moment(startTs).add(this.pollInterval, 'seconds').toISOString();
        const initialState = {
            since: startTs,
            until: endTs,
            poll_interval_sec: 1
        };
        return callback(null, initialState, 1);
    }
    
    pawsGetLogs(state, callback) {
        let collector = this;
        console.info(`O365000001 Collecting data from ${state.since} till ${state.until}`);
        const newState = collector._getNextCollectionState(state);

        // get the content for the timestamp
        const streams = JSON.parse(process.env.O365_CONTENT_STREAMS)
        const contentPromises = streams.map((stream) => {
            return m_o365mgmnt.subscriptionsContent(stream, state.since, state.until)
        });
        // Get 
        Promise.all(contentPromises).then(results => {
            const agregateResult = results.reduce((agg, e) => [...e, ...agg], []);

            const contentPromises = agregateResult.map(({contentUri}) => m_o365mgmnt.getContent(contentUri));
            return Promise.all(contentPromises);
        }).then(content => {
            const flattenedResult = content.reduce((agg, e) => [...e, ...agg], []);

            console.info(`O365000002 Next collection in ${newState.poll_interval_sec} seconds`);
            callback(null, flattenedResult, newState, newState.poll_interval_sec);
        }).catch(err => {
            console.error(`O365000003 Error in collection: ${err}`);
            callback(err);
        })

    }
    
    _getNextCollectionState(curState) {
        const nowMoment = moment();
        const curUntilMoment = moment(curState.until);
        
        // Check if current 'until' is in the future.
        const nextSinceTs = curUntilMoment.isAfter(nowMoment) ?
                nowMoment.toISOString() :
                curState.until;

        const nextUntilMoment = moment(nextSinceTs).add(this.pollInterval, 'seconds');
        // Check if we're behind collection schedule and need to catch up.
        const nextPollInterval = nowMoment.diff(nextUntilMoment, 'seconds') > this.pollInterval ?
                1 : this.pollInterval;
        
        return  {
             since: nextSinceTs,
             until: nextUntilMoment.toISOString(),
             poll_interval_sec: nextPollInterval
        };
    }
    
    pawsFormatLog(msg) {
        const ts = parse.getMsgTs(msg, tsPaths);
        const typeId = parse.getMsgTypeId(msg, typeIdPaths);
        
        let formattedMsg = {
            messageTs: ts.sec,
            priority: 11,
            progName: 'O365Collector',
            message: JSON.stringify(msg),
            messageType: 'json/azure.o365'
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
