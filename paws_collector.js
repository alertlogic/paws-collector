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

const async = require('async');
const debug = require('debug')('index');
const AWS = require('aws-sdk');

const AlAwsCollector = require('@alertlogic/al-aws-collector-js').AlAwsCollector;
const m_packageJson = require('./package.json');

class PawsCollector extends AlAwsCollector {
    constructor(context, creds, collectorType) {
        super(context, 'paws',
              AlAwsCollector.IngestTypes.LOGMSGS,
              m_packageJson.version,
              creds,
              null, [], []);
        console.info('PAWS000100 Loading collector', collectorType);
        this._collectorType = collectorType;
        this.pollInterval = process.env.paws_poll_interval;
    };
    
    register(event) {
        let collector = this;
        let stack = {
            stackName : event.ResourceProperties.StackName,
            pawsCollectorType : collector._collectorType,
            pawsEndpoint : process.env.paws_endpoint
        };
        
        async.waterfall([
            function(asyncCallback) {
                return collector.pawsInitCollectionState(event, asyncCallback);
            },
            function(state, nextInvocationTimeout, asyncCallback) {
                return collector._storeCollectionState({}, state, nextInvocationTimeout, asyncCallback);
            },
            function(sqsResponse, asyncCallback) {
                return collector.pawsGetRegisterParameters(event, asyncCallback);
            }
        ], function(err, customRegister) {
            if (err) {
                console.err('PAWS000101 Error during registration', err);
                return collector.done(err);
            } else {
                let registerProps = Object.assign(stack, customRegister);
                return AlAwsCollector.prototype.register.call(collector, event, registerProps);
            }
        });
    };
    
    deregister(event) {
        let collector = this;
        let stack = {
            stackName : event.ResourceProperties.StackName,
            pawsCollectorType : collector._collectorType
        };
        let custom = collector.pawsGetRegisterParameters(event, function(err, customRegister) {
            if (err) {
                console.warn('PAWS000102 Error during deregistration', err);
            } 
            let registerProps = Object.assign(stack, customRegister);
            return AlAwsCollector.prototype.deregister.call(collector, event, registerProps);
        });
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
        
        async.waterfall([
            function(asyncCallback) {
                return collector.pawsGetLogs(pawsState.priv_collector_state, asyncCallback);
            },
            function(logs, newExtState, nextInvocationTimeout, asyncCallback) {
                console.info('PAWS000200 Log events received ', logs.length);
                return collector.processLog(logs, collector.pawsFormatLog, null, function(err) {
                    return asyncCallback(err, newExtState, nextInvocationTimeout);
                });
            },
            function(newExtState, nextInvocationTimeout, asyncCallback) {
                return collector._storeCollectionState(pawsState, newExtState, nextInvocationTimeout, asyncCallback);
            }
        ], function(error) {
            collector.done(error);
        });
    };
    
    _storeCollectionState(pawsState, newExtState, invocationTimeout, callback) {
        let collector = this;
        var sqs = new AWS.SQS({apiVersion: '2012-11-05'});
        const nextInvocationTimeout = invocationTimeout ? invocationTimeout : collector.pollInterval;
        pawsState.priv_collector_state = newExtState;

        const params = {
            MessageBody: JSON.stringify(pawsState),
            QueueUrl: process.env.paws_state_queue_url,
            DelaySeconds: nextInvocationTimeout
        };
        // Current state message will be removed by Lambda trigger upon successful completion
        sqs.sendMessage(params, callback);
    };
    
    /** 
     * @function collector callback to initialize collection state
     * @param event - collector register event coming in from CFT.
     * @param callback
     * @returns callback - (error, stateObject, nextInvocationTimeoutSec)
     * 
     */
    pawsInitCollectionState(event, callback) {
        throw Error("not implemented pawsInitCollectionState()");
    }
    
    /** 
     * @function collector callback to receive logs data
     * @param state - collection state specific to a PAWS collector.
     * @param callback
     * @returns callback - (error, logsArray, stateObject, nextInvocationTimeoutSec)
     * 
     */
    pawsGetLogs(state, callback) {
        throw Error("not implemented pawsGetLogs()");
    };
    
    /** 
     * @function collector callback to get specific (de)registration parameters
     * @param event - collector register event coming in from CFT during stack Create/Delete operations.
     * @param callback
     * @returns callback - (error, objectWithRegistrationProperties)
     * 
     */
    pawsGetRegisterParameters(event, callback) {
        return callback(null, {});
    };
    
    /** 
     * @function collector callback to format received data
     * Refer to al-collector-js.buildPayload parseCallback param
     */
    pawsFormatLog() {
        throw Error("not implemented pawsFormatLog()");
    };
}

module.exports = {
    PawsCollector: PawsCollector
}

