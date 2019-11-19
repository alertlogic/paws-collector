/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * Lambda function for polling 3rd party service log API and ingest retrieved data
 * into Alert Logic backend.
 *
 * @end
 * -----------------------------------------------------------------------------
 */
'use strict';

const debug = require('debug')('index');
const AWS = require('aws-sdk');

const AlAwsCollector = require('al-aws-collector-js').AlAwsCollector;
const m_packageJson = require('./package.json');

class PawsCollector extends AlAwsCollector {
    constructor(context, creds, extensionName) {
        super(context, 'paws',
              AlAwsCollector.IngestTypes.LOGMSGS,
              m_packageJson.version,
              creds,
              null, [], []);
        console.info('PAWS000001 Loading extension', extensionName);
        this._extensionName = extensionName;
    };
    
    register(event) {
        let collector = this;
        let stack = {
            stackName : event.ResourceProperties.StackName,
            extensionName : collector._extensionName
        };
        let custom = collector.extensionGetRegisterParameters(event);
        registerProps = Object.assign(stack, custom);
        return super.register(event, registerProps);
    };
    
    deregister(event) {
        let collector = this;
        let stack = {
            stackName : event.ResourceProperties.StackName,
            extensionName : collector._extensionName
        };
        let custom = collector.extensionGetRegisterParameters(event);
        registerProps = Object.assign(stack, custom);
        return super.deregister(event, registerProps);
    };
    
    handleEvent(event) {
        let collector = this;
        if (event.Records) {
            let stateMsg = event.Records[0];
            if (stateMsg.eventSourceARN === process.env.paws_state_queue_arn) {
                return collector.handlePollRequest(stateMsg);
            } else {
                return super.handleEvent(event);
            }
        } else {
            return super.handleEvent(event);
        }
    };
    
    handlePollRequest(stateSqsMsg) {
        let collector = this;
        let pawsState = JSON.parse(stateSqsMsg.body);
        
        const logs = collector.extensionGetLogs(pawsState.extension_state, function(err, logs, newState){
            console.log('!!!Received logs', logs.length);
            collector.processLog(logs, collector.extensionFormatLog, null, function(error, newExtState, nextInvocationTimeout) {
                console.log('!!!Logs processed ', error);
                if (!err) {
                    collector._storeCollectionState(stateSqsMsg, pawsState, newExtState, nextInvocationTimeout);
                } else {
                    collector.done(error);
                }
            });
        });
    };
    
    _storeCollectionState(stateSqsMsg, pawsState, newExtState, invocationTimeout) {
        let collector = this;
        var sqs = new AWS.SQS({apiVersion: '2012-11-05'});
        pawsState.extension_state = newExtState;
        
        const nextInvocationTimeout = invocationTimeout ? invocationTimeout : process.env.poll_interval;
        var params = {
            MessageBody: JSON.stringify(pawsState),
            QueueUrl: process.env.paws_state_queue_url,
            DelaySeconds: nextInvocationTimeout
        };
        sqs.sendMessage(params, function(error) {
            return collector.done(error);
        });
    };
    
    extensionGetLogs(state, callback) {
        throw Error("not implemented extensionGetLogs()");
    };
    
    extensionGetRegisterParameters(event) {
        throw Error("not implemented extensionGetRegisterParameters()");
    };
    
    extensionFormatLog() {
        throw Error("not implemented extensionFormatLog()");
    };
}

module.exports = {
    PawsCollector: PawsCollector
}

