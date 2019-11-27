/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * Okta collector class.
 *
 * @end
 * -----------------------------------------------------------------------------
 */
'use strict';

const moment = require('moment');
const okta = require('@okta/okta-sdk-nodejs');
const parse = require('@alertlogic/al-collector-js').Parse;
const PawsCollector = require('@alertlogic/paws-collector').PawsCollector;


const typeIdPaths = [
    { path: ['eventType'] },
    { path: ['legacyEventType'] }
];

const tsPaths = [
    { path: ['published'] }
];


class OktaCollector extends PawsCollector {
    constructor(context, creds) {
        super(context, creds, 'okta');
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
        const oktaClient = new okta.Client({
            orgUrl: process.env.paws_endpoint,
            token: process.env.paws_api_secret
        });
        console.info(`OKTA000001 Collecting data from ${state.since} till ${state.until}`);
        const collection = oktaClient.getLogs({
            since: state.since,
            until: state.until
        });
        let logAcc = [];
        collection.each(log => {
            logAcc.push(log);
        })
        .then(() => {
            const newState = collector._getNextCollectionState(state);
            console.info(`OKTA000002 Next collection in ${newState.poll_interval_sec} seconds`);
            return callback(null, logAcc, newState, newState.poll_interval_sec);
        })
        .catch((error) => {
            return callback(error);
        });
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
            progName: 'OktaCollector',
            message: JSON.stringify(msg),
            messageType: 'json/aws.okta'
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
    OktaCollector: OktaCollector
}