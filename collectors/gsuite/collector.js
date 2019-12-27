/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * Gsuite collector class.
 *
 * @end
 * -----------------------------------------------------------------------------
 */
'use strict';

const moment = require('moment');
const PawsCollector = require('@alertlogic/paws-collector').PawsCollector;
const parse = require('@alertlogic/al-collector-js').Parse;

const { auth } = require('google-auth-library');
const utils = require('./utils');


const typeIdPaths = [
    { path: ['kind'] }
];

const tsPaths = [
    { path: ['id','time'] }
];


class GsuiteCollector extends PawsCollector {
    constructor(context, creds) {
        super(context, creds, 'gsuite');
    }
    
    pawsInitCollectionState(event, callback) {
        const startTs = process.env.paws_collection_start_ts ? process.env.paws_collection_start_ts : moment().subtract(5, 'minutes').toISOString();

        const endTs = moment(startTs).add(this.pollInterval, 'seconds').toISOString();

        const initialState = {
            // TODO: define initial collection state specific to your collector.
            // You will get this state back with each invocation
            since: startTs,
            until: endTs,
            poll_interval_sec: 1
        };
        return callback(null, initialState, 1);
    }
    
    pawsGetLogs(state, callback) {
        let collector = this;
        
        // TODO: Change this to logging
        // TODO: Change the environment vars to CFT vars
        const keysEnvVar = process.env.paws_creds;
        if (!keysEnvVar) {
            throw new Error('The $CREDS environment variable was not found!');
        }

        const keys = JSON.parse(keysEnvVar);
        const client = auth.fromJSON(keys);
        client.subject = process.env.paws_email_id;
        // TODO: change this to CFT var
        client.scopes = process.env.paws_scopes.split(',');
        const applicationNames = process.env.paws_application_names.split(',');
        console.info(`GSUI000001 Collecting data from ${state.since} till ${state.until}`);
        
        let params = {startTime : state.since, endTime: state.until, applicationNames: applicationNames};

        applicationNames.forEach((applicationName) => {
            params['applicationName'] = applicationName;
            utils.listEvents(client, params, [], function(collection, error){
                if (error){
                    return callback(error);
                }

                const newState = collector._getNextCollectionState(state);
                console.info(`GSUI000002 Next collection in ${newState.poll_interval_sec} seconds`);
                
                return callback(null, collection, newState, newState.poll_interval_sec);

            });        
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
            // TODO: define the next collection state.
            // This needs to be in the same format as the intial colletion state above
             since: nextSinceTs,
             until: nextUntilMoment.toISOString(),
             poll_interval_sec: nextPollInterval
        };
    }
    
    pawsFormatLog(msg) {
        // TODO: double check that this message parsing fits your use case
        const ts = parse.getMsgTs(msg, tsPaths);
        const typeId = parse.getMsgTypeId(msg, typeIdPaths);
        
        let formattedMsg = {
            messageTs: ts.sec,
            priority: 11,
            progName: 'GsuiteCollector',
            message: JSON.stringify(msg),
            messageType: 'json/gsuite'
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
    GsuiteCollector: GsuiteCollector
}
