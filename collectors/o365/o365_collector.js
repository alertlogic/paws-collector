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
        let startTs = process.env.paws_collection_start_ts ? 
                process.env.paws_collection_start_ts :
                    moment().toISOString();
        let endTs;

        if(moment().diff(startTs, 'days') > 7){
            startTs = moment().subtract(7, 'days').toISOString();
            console.log("Start timestamp is more than 7 days in the past. This is not allowed in the MS managment API. setting the start time to 7 days in the past");
        }
        
        if(moment().diff(startTs, 'hours') > 24){
            endTs = moment(startTs).add(24, 'hours').toISOString();
        }
        else {
            endTs = moment(startTs).toISOString();
        }
        const initialState = {
            since: startTs,
            until: endTs,
            poll_interval_sec: this.pollInterval
        };
        return callback(null, initialState, 1);
    }

    pawsGetRegisterParameters(event, callback){
        const regValues = {
            dataType: this._ingestType,
            version: this._version,
            pawsCollectorType: 'o365',
            collectorId: "none",
            stackName: event.ResourceProperties.StackName
        };

        callback(null, regValues);
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
        // Get the streams from env vars and collect the content
        Promise.all(contentPromises).then(results => {
            const agregateResult = results.reduce((agg, e) => [...e, ...agg], []);

            const contentPromises = agregateResult.map(({contentUri}) => m_o365mgmnt.getContent(contentUri));
            return Promise.all(contentPromises);
        // Call all of the content urls and agregate the resutls
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
