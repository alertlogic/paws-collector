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

const CREDS_FILE_PATH = '/tmp/paws_creds.json';
var PAWS_DECRYPTED_CREDS = null;

function getPawsCredsFile(){
    return new Promise((resolve, reject) => {
        // check if the creds file is cached and retrieve it if it is not
        if(!fs.existsSync(CREDS_FILE_PATH)){
            const s3 = new AWS.S3({apiVersion: '2006-03-01'});
            const kms = new AWS.KMS();

            // doing the string manipulation here because doing it here is way less groos than doing it in the cfn
            const s3PathParts = process.env.paws_creds_file_path.split(/);

            // retrive the object from S3
            var params = {
                Bucket: s3PathParts.shift(),
                Key: s3PathParts.slice(1).join('/')
            };
            s3.getObject(params, (err, data) => {
                if (err) return reject(Error(err, err.stack));

                // encrypt the file contents and cache on the lambda container file system
                const encryptParams ={
                    Plaintext: data.Body
                };
                kms.encrypt(encryptParams, (encryptError, encryptResponse) => {
                    if (err) return reject(Error(err, err.stack));

                    const fs.writeiFileSync(CREDS_FILE_PATH, encryptResponse.CiphertextBlob);
                    return resolve(encryptResponse.CiphertextBlob);
                })
            });
        }
        else {
            return resolve(fs.readFileSync(CREDS_FILE_PATH));
        }
    });
};

function getDecryptedPawsCredentials(credsBuffer, callback) {
    if (PAWS_DECRYPTED_CREDS) {
        return callback(null, PAWS_DECRYPTED_CREDS);
    } else {
        const kms = new AWS.KMS();
        kms.decrypt(
            {CiphertextBlob: credsBuffer},
            (err, data) => {
                if (err) {
                    return callback(err);
                } else {
                    PAWS_DECRYPTED_CREDS = {
                        auth_type: process.env.paws_api_auth_type,
                        client_id: process.env.paws_api_client_id,
                        secret: data.Plaintext.toString('.ascii')
                    };

                    return callback(null, PAWS_DECRYPTED_CREDS);
                }
            });
    }
}

class PawsCollector extends AlAwsCollector {
    
    static load() {
        return new Promise(function(resolve, reject){
            AlAwsCollector.load().then(function(aimsCreds) {
                let credsPromise;

                switch(process.env.paws_auth_type){
                    case 's3object':
                        credsPromise = getPawsCredsFile();
                        break;
                    default:
                        const enVarCreds = Buffer.from(process.env.paws_api_secret, 'base64');
                        credsPromise = new Promise(res => res(enVarCreds));
                }

                credsPromise.then(credsBuffer => {
                    getDecryptedPawsCredentials(credsBuffer, function(err, pawsCreds) {
                        if (err){
                            reject(err);
                        } else {
                            resolve({aimsCreds : aimsCreds, pawsCreds: pawsCreds});
                        }
                    });
                });
            });
        });
    }

    constructor(context, {aimsCreds, pawsCreds}) {
        super(context, 'paws',
              AlAwsCollector.IngestTypes.LOGMSGS,
              m_packageJson.version,
              aimsCreds,
              null, [], []);
        console.info('PAWS000100 Loading collector', process.env.paws_type_name);
        this._pawsCreds = pawsCreds;
        this._pawsCollectorType = process.env.paws_type_name;
        this.pollInterval = process.env.paws_poll_interval;
    };
    
    get secret () {
        return this._pawsCreds.secret;
    };
    
    get clientId () {
        return this._pawsCreds.client_id;
    };
    
    get authType() {
        return this._pawsCreds.auth_type;
    };
    
    getProperties() {
        const baseProps = super.getProperties();
        let pawsProps = {
            pawsCollectorType : this._pawsCollectorType,
            pawsEndpoint : process.env.paws_endpoint
        };
        return Object.assign(pawsProps, baseProps);
    };
    
    register(event) {
        let collector = this;
        let pawsRegisterProps = this.getProperties();
        
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
                let registerProps = Object.assign(pawsRegisterProps, customRegister);
                return AlAwsCollector.prototype.register.call(collector, event, registerProps);
            }
        });
    };
    
    deregister(event) {
        let collector = this;
        let pawsRegisterProps = {
            pawsCollectorType : collector._pawsCollectorType
        };
        let custom = collector.pawsGetRegisterParameters(event, function(err, customRegister) {
            if (err) {
                console.warn('PAWS000102 Error during deregistration', err);
            } 
            let registerProps = Object.assign(pawsRegisterProps, customRegister);
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
            function(logs, privCollectorState, nextInvocationTimeout, asyncCallback) {
                console.info('PAWS000200 Log events received ', logs.length);
                return collector.processLog(logs, collector.pawsFormatLog, null, function(err) {
                    return asyncCallback(err, privCollectorState, nextInvocationTimeout);
                });
            },
            function(privCollectorState, nextInvocationTimeout, asyncCallback) {
                return collector._storeCollectionState(pawsState, privCollectorState, nextInvocationTimeout, asyncCallback);
            }
        ], function(error) {
            collector.done(error);
        });
    };
    
    _storeCollectionState(pawsState, privCollectorState, invocationTimeout, callback) {
        if (Array.isArray(privCollectorState)) {
            return this._storeCollectionStateArray(pawsState, privCollectorState, invocationTimeout, callback);
        } else {
            return this._storeCollectionStateSingle(pawsState, privCollectorState, invocationTimeout, callback);
        }
    }
    
    _storeCollectionStateArray(pawsState, privCollectorStates, invocationTimeout, callback) {
        // TODO: if 'privCollectorStates' length more than 10 split into multiple SQS messages batches (10 messages per batch) 
        let collector = this;
        var sqs = new AWS.SQS({apiVersion: '2012-11-05'});
        const nextInvocationTimeout = invocationTimeout ? invocationTimeout : collector.pollInterval;
        let SQSMsgs = privCollectorStates.map(function(privState, index) {
            let pState = pawsState;
            pState.priv_collector_state = privState;
            return {
                Id: index.toString(),
                MessageBody: JSON.stringify(pawsState),
                DelaySeconds: nextInvocationTimeout
            };
        });
        
        const params = {
            Entries: SQSMsgs,
            QueueUrl: process.env.paws_state_queue_url
        };
        // Current state message will be removed by Lambda trigger upon successful completion
        sqs.sendMessageBatch(params, callback);
    }
    _storeCollectionStateSingle(pawsState, privCollectorState, invocationTimeout, callback) {
        let collector = this;
        var sqs = new AWS.SQS({apiVersion: '2012-11-05'});
        const nextInvocationTimeout = invocationTimeout ? invocationTimeout : collector.pollInterval;
        pawsState.priv_collector_state = privCollectorState;

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
     * @returns callback - (error, stateObjectOrArray, nextInvocationTimeoutSec).
     * 
     */
    pawsInitCollectionState(event, callback) {
        throw Error("not implemented pawsInitCollectionState()");
    }
    
    /** 
     * @function collector callback to receive logs data
     * @param state - collection state specific to a PAWS collector.
     * @param callback
     * @returns callback - (error, logsArray, stateObjectOrArray, nextInvocationTimeoutSec).
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
     * Refer to al-collector-js.buildPayload parseCallback parameter
     */
    pawsFormatLog() {
        throw Error("not implemented pawsFormatLog()");
    };
}

module.exports = {
    PawsCollector: PawsCollector
}

