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
const { google } = require('googleapis');
const { auth } = require('google-auth-library');
const PawsCollector = require('@alertlogic/paws-collector').PawsCollector;

const typeIdPaths = [
    { path: ['kind'] }
];

const tsPaths = [
    { path: ['id','time'] }
];

function  listLoginEvents(auth, params, callback) {
    const service = google.admin({version: 'reports_v1', auth});
    params['userKey'] = 'all';
    params['applicationName'] = 'login';
    service.activities.list(params, (err, res) => {
        if (!('items' in res.data)) return Error('No more logs');; 
        if (err) return callback(null, err);
        return callback(res.data.items);
   });
}

class GsuiteCollector extends PawsCollector {

    pawsInitCollectionState(event, callback) {
        const initialState = {
            since: process.env.paws_collection_start_ts ? process.env.paws_collection_start_ts : moment().subtract(5, 'minutes').toISOString(),
            poll_interval_sec: 5
        };
        return callback(null, initialState, 1);
    }
    
    pawsGetLogs(state, callback) {
        let collector = this;

        const keysEnvVar = process.env.paws_creds;
        if (!keysEnvVar) {
            throw new Error('The $CREDS environment variable was not found!');
        }

        const keys = JSON.parse(keysEnvVar);
        const client = auth.fromJSON(keys);
        client.subject = process.env.paws_email_id;
        client.scopes = ['https://www.googleapis.com/auth/admin.reports.audit.readonly'];

        let logAcc = [];
        let params = {startTime : state.since};
        listLoginEvents(client, params, function(collection, error){
            if (error){
                return callback(error);
            }

            const nextLogId = (collection.length > 0) ? collection[collection.length-1].log_id : state.last_log_id;
            const lastLogTs = (collection.length > 0) ? collection[collection.length-1].id.time : null;
            const newState = collector._getNextCollectionState(state, nextLogId, lastLogTs);
            console.info(`AUTZ000002 Next collection in ${newState.poll_interval_sec} seconds`);
            
            return callback(null, collection, newState, newState.poll_interval_sec);

        });        
    }
    
    _getNextCollectionState(curState, nextLogId, lastLogTs) {
        const nowMoment = moment();
        const lastLogMoment = moment(lastLogTs);
        
        // Check if we're behind collection schedule and need to catch up.
        const nextPollInterval = nowMoment.diff(lastLogMoment, 'seconds') > this.pollInterval ?
                1 : this.pollInterval;
        
        return  {
            last_log_id: nextLogId,
            since: lastLogMoment.format(),
            poll_interval_sec: nextPollInterval
        };
    }
    
    pawsFormatLog(msg) {
        const ts = parse.getMsgTs(msg, tsPaths);
        const typeId = parse.getMsgTypeId(msg, typeIdPaths);
        
        let formattedMsg = {
            messageTs: ts.sec,
            priority: 11,
            progName: 'GsuiteCollector',
            message: JSON.stringify(msg),
            messageType: 'json/GsuiteCollector'
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
