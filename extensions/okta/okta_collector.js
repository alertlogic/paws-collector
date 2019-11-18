/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * Okta collector class.
 *
 * @end
 * -----------------------------------------------------------------------------
 */
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
    
    extensionGetRegisterParameters(event) {
        return {
            okta_endpoint: process.env.okta_endpoint
        };
    }
    
    extensionGetLogs(event, state, callback) {
        const oktaClient = new okta.Client({
            orgUrl: process.env.okta_endpoint,
            token: process.env.okta_token
        });
        console.log('!!!Collecting logs.');
        const collection = oktaClient.getLogs({
            since: '2019-11-15T23:00:00Z',
            until: '2019-11-15T23:30:00Z'
        });
        let logAcc = [];
        collection.each(log => {
            logAcc.push(log);
        })
        .then(() => {
            console.log('!!!done');
            return callback(null, logAcc, state);
        })
        .catch((error) => {
            console.log('!!! Logs Error', error);
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