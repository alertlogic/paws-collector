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
const PawsCollector = require('paws-collector').PawsCollector;


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
    
    extensionInitCollectionState(event, callback) {
        const startTs = process.env.okta_collection_start_ts ? 
                process.env.okta_collection_start_ts :
                    moment().toISOString();
        const endTs = moment(startTs).add(15, 'minutes').toISOString();
        const initialState = {
            since: startTs,
            until: endTs
        };
        return callback(null, initialState, 1);
    }
    
    extensionGetRegisterParameters(event, callback) {
        return callback(null, {
            okta_endpoint: process.env.okta_endpoint
        });
    }
    
    extensionGetLogs(state, callback) {
        const oktaClient = new okta.Client({
            orgUrl: process.env.okta_endpoint,
            token: process.env.okta_token
        });
        const collection = oktaClient.getLogs({
            since: state.since,
            until: state.until
        });
        let logAcc = [];
        collection.each(log => {
            logAcc.push(log);
        })
        .then(() => {
            return callback(null, logAcc, state, 0);
        })
        .catch((error) => {
            return callback(error);
        });
    }
    
    extensionFormatLog(msg) {
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