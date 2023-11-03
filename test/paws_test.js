const fs = require('fs');
const assert = require('assert');
const sinon = require('sinon');
const m_response = require('cfn-response');
const ddLambda = require('datadog-lambda-js');

const pawsMock = require('./paws_mock');
var m_alCollector = require('@alertlogic/al-collector-js');
var PawsCollector = require('../paws_collector').PawsCollector;
const m_al_aws = require('@alertlogic/al-aws-collector-js');
const moment = require('moment');
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;
const pawsStub = require('./paws_stub');
const {
    CloudWatch
} = require("@aws-sdk/client-cloudwatch"),
{
    DynamoDB
} = require("@aws-sdk/client-dynamodb"),
{
    KMS
} = require("@aws-sdk/client-kms"),
{
    SQS
} = require("@aws-sdk/client-sqs"),
{
    SSM
} = require("@aws-sdk/client-ssm");

var alserviceStub = {};
var responseStub = {};
var setEnvStub = {};
var sqsSendMessageBatchStub = {};



function setAlServiceStub() {
    alserviceStub.get = sinon.stub(m_alCollector.AlServiceC.prototype, 'get').callsFake(
        function fakeFn(path, extraOptions) {
            return new Promise(function(resolve, reject) {
                var ret = null;
                switch (path) {
                    case '/residency/default/services/ingest/endpoint':
                        ret = {
                            ingest: 'new-ingest-endpoint'
                        };
                        break;
                    case '/residency/default/services/azcollect/endpoint':
                        ret = {
                            azcollect: 'new-azcollect-endpoint'
                        };
                        break;
                    case '/residency/default/services/collector_status/endpoint':
                        ret = {
                            azcollect: 'new-collector-status-endpoint'
                        };
                        break;
                    default:
                        break;
                }
                return resolve(ret);
            });
        });
    alserviceStub.post = sinon.stub(m_alCollector.AlServiceC.prototype, 'post').callsFake(
            function fakeFn(path, extraOptions) {
                return new Promise(function(resolve, reject) {
                    return resolve();
                });
            });
    alserviceStub.put = sinon.stub(m_alCollector.AlServiceC.prototype, 'put').callsFake(
        function fakeFn(path, extraOptions) {
            return new Promise(function (resolve, reject) {
                return resolve();
            });
        });
    alserviceStub.del = sinon.stub(m_alCollector.AlServiceC.prototype, 'deleteRequest').callsFake(
            function fakeFn(path) {
                return new Promise(function(resolve, reject) {
                    return resolve();
                });
            });
}

function restoreAlServiceStub() {
    alserviceStub.get.restore();
    alserviceStub.post.restore();
    alserviceStub.del.restore();
    alserviceStub.put.restore();
}


function mockSetEnvStub() {
    setEnvStub = sinon.stub(m_al_aws.Util, 'setEnv').callsFake((vars, callback)=>{
        const {
            ingest_api,
            azcollect_api
        } = vars;
        process.env.ingest_api = ingest_api ? ingest_api : process.env.ingest_api;
        process.env.azollect_api = azcollect_api ? azcollect_api : process.env.azollect_api;
        const returnBody = {
            Environment: {
                Varaibles: vars
            }
        };
        return callback(null, returnBody);
    });
}

function mockSQSSendMessage(returnObject) {
    pawsStub.mock(SQS, 'sendMessage', function (params, callback) {
        let buf = Buffer.from(JSON.stringify(returnObject));
        return callback(null, {Body: buf});
    });
}

function mockSQSSendMessageBatch(returnObject) {
    sqsSendMessageBatchStub = pawsStub.mock(SQS, 'sendMessageBatch', function (params, callback) {
        let buf = Buffer.from(JSON.stringify(returnObject));
        return callback(null, {Body: buf});
    });
}

function mockDDB(getItemStub, putItemStub, updateItemStub, batchWriteItemStub) {
    const defaultMock = (_params, callback) => {
        return callback(null, {});
    };
    const promiseMock = (_params) => {
        return new Promise((resolve,reject)=>{
            resolve({});
        });
    };

    pawsStub.mock(DynamoDB, 'getItem', getItemStub ? getItemStub : promiseMock);

    pawsStub.mock(DynamoDB, 'putItem', putItemStub ? putItemStub : defaultMock);

    pawsStub.mock(DynamoDB, 'updateItem', updateItemStub? updateItemStub : defaultMock);

    pawsStub.mock(DynamoDB, 'batchWriteItem',batchWriteItemStub ? batchWriteItemStub : promiseMock);
}

function restoreDDB(){
    pawsStub.restore(DynamoDB,'getItem');
    pawsStub.restore(DynamoDB,'putItem');
    pawsStub.restore(DynamoDB,'updateItem');
    pawsStub.restore(DynamoDB,'batchWriteItem');
}

function mockCloudWatch() {
    pawsStub.mock(CloudWatch, 'putMetricData', (params, callback) => callback());
}

function gen_state_objects(num) {
    return new Array(num).fill(0).map((e,i) => ({state: 'new-state-' + i}));
}

class TestCollector extends PawsCollector {
    constructor(ctx, creds) {
        super(ctx, creds);
    }
    
    set mockGetLogsError(msg = null) {
        this._mockGetLogsError = msg;
    }
    
    get mockGetLogsError() {
        return this._mockGetLogsError;
    }
    
    pawsInitCollectionState(event, callback) {
        return callback(null, {state: 'initial-state'}, 900);
    }   
    
    pawsGetLogs(state, callback) {
        return callback(this.mockGetLogsError, ['log1', 'log2'], {state: 'new-state'}, 900);
    }
    
    pawsGetRegisterParameters(event, callback) {
        return callback(null, {register: 'test-param'});
    }
    
    pawsFormatLog(msg) {
        const collector = this;
        
        let formattedMsg = {
            messageTs: 12345678,
            priority: 11,
            progName: 'OktaCollector',
            message: JSON.stringify(msg),
            messageType: 'json/aws.test',
            applicationId: collector.application_id
        };
        return formattedMsg;
    }
}

class TestMaxLogSizeCollector extends PawsCollector {
    constructor(ctx, creds) {
        super(ctx, creds);
    }
    
    set mockGetLogsError(msg = null) {
        this._mockGetLogsError = msg;
    }
    
    get mockGetLogsError() {
        return this._mockGetLogsError;
    }
    
    pawsInitCollectionState(event, callback) {
        return callback(null, {state: 'initial-state'}, 900);
    }   
    
    pawsGetLogs(state, callback) {
        const logs = [];
        for (let i = 0; i < 25000; i++) {
            logs.push('log'+Math.random());
       }
        return callback(this.mockGetLogsError, logs, {state: 'new-state'}, 900);
    }
    
    pawsGetRegisterParameters(event, callback) {
        return callback(null, {register: 'test-param'});
    }
    
    pawsFormatLog(msg) {
        const collector = this;
        
        let formattedMsg = {
            messageTs: 12345678,
            priority: 11,
            progName: 'OktaCollector',
            message: JSON.stringify(msg),
            messageType: 'json/aws.test',
            applicationId: collector.application_id
        };
        return formattedMsg;
    }
}

class TestCollectorNoOverrides extends PawsCollector {
    constructor(ctx, creds) {
        super(ctx, creds);
    }
}

class TestCollectorMultiState extends PawsCollector {
    constructor(ctx, creds) {
        super(ctx, creds);
    }
    
    pawsInitCollectionState(event, callback) {
        return callback(null, [{state: 'initial-state-1'}, {state: 'initial-state-2'}], 900);
    }
    
    pawsGetLogs(state, callback) {
        return callback(null, ['log1','log2'], gen_state_objects(98), 900);
    }

    pawsGetRegisterParameters(event, callback) {
        return callback(null, {register: 'test-param'});
    }
    
    pawsFormatLog(msg) {
        const collector = this;
        
        let formattedMsg = {
            messageTs: 12345678,
            priority: 11,
            progName: 'OktaCollectorArrayState',
            message: JSON.stringify({test: 'message'}),
            messageType: 'json/aws.test',
            applicationId: collector.application_id
        };
        
        return formattedMsg;
    }
}

describe('Unit Tests', function() {
    beforeEach(function(){
        pawsStub.mock(KMS, 'decrypt', function (params, callback) {
            const data = {
                    Plaintext : Buffer.from('decrypted-aims-sercret-key')
                };
            return callback(null, data);
        });
        pawsStub.mock(KMS, 'encrypt', function (params, callback) {
            const data = {
                CiphertextBlob : Buffer.from('creds-from-file').toString('base64')
            };
            return callback(null, data);
        });

        pawsStub.mock(SSM, 'getParameter', function (params, callback) {
            const data = process.env.ssm_direct ? 'decrypted-aims-sercret-key': Buffer.from('decrypted-aims-sercret-key');
            return callback(null, {Parameter : { Value: process.env.ssm_direct ? data : data.toString('base64')}});
        });

        responseStub = sinon.stub(m_response, 'send').callsFake(
            function fakeFn(event, mockContext, responseStatus, responseData, physicalResourceId) {
                mockContext.succeed();
            });

        setAlServiceStub();
        mockSetEnvStub();
        
        mockSQSSendMessage({});
        mockSQSSendMessageBatch({});
    });

    afterEach(function(){
        if(fs.existsSync('/tmp/paws_creds')){
            fs.unlinkSync('/tmp/paws_creds');
        }
        restoreAlServiceStub();
        setEnvStub.restore();
        responseStub.restore();
        pawsStub.restore(KMS,'decrypt');
        pawsStub.restore(KMS,'encrypt');
        pawsStub.restore(SSM, 'getParameter');
        pawsStub.restore(SQS, 'sendMessage');
        sqsSendMessageBatchStub.restore();
    });
    
    describe('Credential file caching tests', function(){
        const TMP_CREDS_PATH = '/tmp/paws_creds';
        it('Gets a creds and set into file', function(done){
            TestCollector.load().then(function(creds) {
               const testCred =  Buffer.from(creds.pawsCreds.secret).toString('base64');
                assert.equal(fs.existsSync(TMP_CREDS_PATH), true);
                assert.equal(fs.readFileSync(TMP_CREDS_PATH, 'base64'), testCred);  
                done();
            });
        });

        it('Caches the file correctly if ssm-direct true', function(done){
            TestCollector.load().then(function(creds) {   
                process.env.ssm_direct = 'true';
                assert.equal(fs.existsSync(TMP_CREDS_PATH), true);
                assert.equal(fs.readFileSync(TMP_CREDS_PATH, 'utf-8'), creds.pawsCreds.secret);
                process.env.ssm_direct = 'false';
                done();
            });
        });
        it('Gets a cached file correctly and ssm getParameter not called if file exist ', function(done){
            fs.writeFileSync(TMP_CREDS_PATH, 'alwaysdrinkyourovaltine', 'base64');
            TestCollector.load().then(function(creds) {
                assert.notEqual(fs.readFileSync(TMP_CREDS_PATH, 'base64').length, 0);
                done();
            });
        });
        it('Caches the file correctly', function(done){
            TestCollector.load().then(function(creds) {
                const testCred = Buffer.from(creds.pawsCreds.secret).toString('base64');
                assert.equal(fs.existsSync(TMP_CREDS_PATH), true);
                assert.equal(fs.readFileSync(TMP_CREDS_PATH, 'base64'), testCred);
                done();
            });
        });
    });
    describe('Send DD metric Tests', function(){
        it('sends DD metric', function(done){
            let ctx = {
                invokedFunctionArn : pawsMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            
            const ddLambdaSendMetricStub = sinon.stub(ddLambda, 'sendDistributionMetric').callsFake(() => true);

            TestCollector.load().then(function(creds) {
                var collector = new TestCollector(ctx, creds);
                collector.reportDDMetric('test_metric', 2);

                assert(ddLambdaSendMetricStub.calledWith('paws_okta.test_metric'));
                done();
            });
        });
    });
    describe('State Deduplicationt Tests', function(){
        beforeEach(function () {
        });
        afterEach(function () {
            restoreDDB();  
        });
        it('creates a new DDB item when the states does not exist', function(done){
            const fakeFun = function(_params, callback){return callback(null, {});};
            const putItemStub = sinon.stub().callsFake(fakeFun);
            const updateItemStub = sinon.stub().callsFake(fakeFun);

            mockDDB(null, putItemStub, updateItemStub);
            let ctx = {
                invokedFunctionArn : pawsMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    const putItemArgs = putItemStub.args[0][0];
                    const updateItemArgs = updateItemStub.args[0][0];
                    assert.equal(putItemStub.called, true, 'should put a new item in');
                    assert.equal(updateItemStub.called, true, 'should update the item to complete');
                    assert.equal(putItemArgs.Item.MessageId.S, "5fea7756-0ea4-451a-a703-a558b933e274");
                    assert.equal(updateItemArgs.Key.MessageId.S, "5fea7756-0ea4-451a-a703-a558b933e274");
                    done();
                }
            };

            const testEvent = {
                Records: [
                    {
                        "body": "{\n  \"priv_collector_state\": {\n    \"since\": \"123\",\n    \"until\": \"321\"\n  }\n}",
                        "md5OfBody": "5d172f741470c05e3d2a45c8ffcd9ab3",
                        "messageId": "5fea7756-0ea4-451a-a703-a558b933e274",
                        "eventSourceARN": "arn:aws:sqs:us-east-1:352283894008:test-queue",
                    }
                ]
            };
            
            TestCollector.load().then(function(creds) {
                var collector = new TestCollector(ctx, creds);
                collector.handleEvent(testEvent);
            });
        });
        it('skips the state if it is already completed', function(done){
            const mockRecord = {
                "body": "{\n  \"priv_collector_state\": {\n    \"since\": \"123\",\n    \"until\": \"321\"\n  }\n}",
                "md5OfBody": "5d172f741470c05e3d2a45c8ffcd9ab3",
                "messageId": "5fea7756-0ea4-451a-a703-a558b933e274",
                "eventSourceARN": "arn:aws:sqs:us-east-1:352283894008:test-queue",
            };
            const fakeGetFun = function (_params) {
                return new Promise((resolve, reject) => {
                    const mockItem = {
                        Item: {
                            MessageId: { S: mockRecord.messageId },
                            Status: {S: 'COMPLETE'},
                            Updated: {N: `${Date.now() / 1000 - 100}`}
                        }
                    };
                    resolve(mockItem);
                });
            };
            const fakeFun = function(_params, callback){return callback(null, {data:null});};
            const getItemStub = sinon.stub().callsFake(fakeGetFun);
            const putItemStub = sinon.stub().callsFake(fakeFun);
            const updateItemStub = sinon.stub().callsFake(fakeFun);

            mockDDB(getItemStub, putItemStub, updateItemStub);

            let ctx = {
                invokedFunctionArn : pawsMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail("invocation should fail");
                    done();
                    assert.equal(getItemStub.called, true, 'should get new item');
                    assert.equal(putItemStub.notCalled, true, 'should not put a new item in');
                    assert.equal(updateItemStub.notCalled, true, 'should not update the item to complete');
                    if (error === '{"errorCode":"DUPLICATE_STATE"}')
                        done();
                    else
                        assert.fail("invocation have another error code");
                },
                succeed : function(error) {
                    assert.equal(error, null);
                    assert.equal(getItemStub.called, true, 'should get new item');
                    assert.equal(putItemStub.notCalled, true, 'should not put a new item in');
                    done();
                }
            };

            const testEvent = {
                Records: [
                    mockRecord
                ]
            };
            
            TestCollector.load().then(function(creds) {
                var collector = new TestCollector(ctx, creds);
                collector.handleEvent(testEvent);
            });
        });
        it('throws an error if the state is bing processed by another invocation', function(done){
            const mockRecord = {
                "body": "{\n  \"priv_collector_state\": {\n    \"since\": \"123\",\n    \"until\": \"321\"\n  }\n}",
                "md5OfBody": "5d172f741470c05e3d2a45c8ffcd9ab3",
                "messageId": "5fea7756-0ea4-451a-a703-a558b933e274",
                "eventSourceARN": "arn:aws:sqs:us-east-1:352283894008:test-queue",
            };
            const fakeGetFun = function(param){
                const mockItem = {
                    Item: {
                        MessageId: { S: mockRecord.messageId },
                        Status: {S: 'INCOMPLETE'},
                        Updated: {N: `${Date.now()/1000 - 100 }`}
                    }
                };
                return new Promise((resolve,reject)=>{
                    resolve(mockItem);
                });
            };
            const fakeFun = function(_params, callback){return callback(null, {data:null});};
            const getItemStub = sinon.stub().callsFake(fakeGetFun);
            const putItemStub = sinon.stub().callsFake(fakeFun);
            const updateItemStub = sinon.stub().callsFake(fakeFun);

            mockDDB(getItemStub, putItemStub, updateItemStub);

            let ctx = {
                invokedFunctionArn : pawsMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.equal(getItemStub.called, true, 'should get new item');
                    assert.equal(putItemStub.notCalled, true, 'should not put a new item in');
                    assert.equal(updateItemStub.notCalled, true, 'should not update the item to complete');
                    done();
                },
                succeed : function() {
                    done();
                }
            };

            const testEvent = {
                Records: [
                    mockRecord
                ]
            };
            
            TestCollector.load().then(function(creds) {
                var collector = new TestCollector(ctx, creds);
                collector.handleEvent(testEvent);
            });
        });
        it('updates the state if it is successful', function(done){
            const fakeFun = function(_params, callback){return callback(null, {data:null});};
            const updateItemStub = sinon.stub().callsFake(fakeFun);

            mockDDB(null, null, updateItemStub);

            let ctx = {
                invokedFunctionArn : pawsMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    const updateItemArgs = updateItemStub.args[0][0];
                    assert.equal(updateItemStub.called, true, 'should update the item to complete');
                    assert.equal(updateItemArgs.Key.MessageId.S, "5fea7756-0ea4-451a-a703-a558b933e274");
                   
                    done();
                }
            };

            const testEvent = {
                Records: [
                    {
                        "body": "{\n  \"priv_collector_state\": {\n    \"since\": \"123\",\n    \"until\": \"321\"\n  }\n}",
                        "md5OfBody": "5d172f741470c05e3d2a45c8ffcd9ab3",
                        "messageId": "5fea7756-0ea4-451a-a703-a558b933e274",
                        "eventSourceARN": "arn:aws:sqs:us-east-1:352283894008:test-queue",
                    }
                ]
            };
            
            TestCollector.load().then(function(creds) {
                var collector = new TestCollector(ctx, creds);
                collector.handleEvent(testEvent);
            });
        });
    });
    describe('Poll Request Tests', function() {
        it('poll request success, single state', function(done) {
            mockDDB();
            let ctx = {
                invokedFunctionArn : pawsMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    restoreDDB();
                    done();
                }
            };

            const testEvent = {
                Records: [
                    {
                        "body": "{\n  \"priv_collector_state\": {\n    \"since\": \"123\",\n    \"until\": \"321\"\n  }\n}",
                        "eventSourceARN": "arn:aws:sqs:us-east-1:352283894008:test-queue",
                    }
                ]
            };
            
            TestCollector.load().then(function(creds) {
                var collector = new TestCollector(ctx, creds);
                collector.handleEvent(testEvent);
            });
        });
        
        it('poll request error, single state', function(done) {
            const fakeFun = function(_params, callback){return callback(null, {data:null});};
            const updateItemStub = sinon.stub().callsFake(fakeFun);
            mockDDB(null, null, updateItemStub);
            let ctx = {
                invokedFunctionArn : pawsMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail('Invocation should succeed.');
                },
                succeed : function() {     
                    sinon.assert.calledOnce(updateItemStub);
                    restoreDDB();
                    done();
                    
                },
                getRemainingTimeInMillis: function(){
                    return 5000;
                }
            };

            const testEvent = {
                Records: [
                    {
                        "body": "{\n  \"priv_collector_state\": {\n    \"since\": \"123\",\n    \"until\": \"321\"\n  }\n}",
                        "eventSourceARN": "arn:aws:sqs:us-east-1:352283894008:test-queue",
                    }
                ]
            };
            
            TestCollector.load().then(function(creds) {
                var collector = new TestCollector(ctx, creds);
                collector.mockGetLogsError = 'Error getting logs';
                collector.handleEvent(testEvent);
                // Verify that collector.done called the context succeed.
                assert(ctx.getRemainingTimeInMillis.callCount, 1);
                assert(AlLogger.error.calledWith(`PAWS000303 Error handling poll request: ${JSON.stringify(collector.mockGetLogsError)}`));
                assert(ctx.succeed.calledOnce);
            });
        });
        
        it('poll request success, multiple state', function(done) {
            mockDDB();

            let ctx = {
                invokedFunctionArn : pawsMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    restoreDDB();
                    done();
                }
            };

            const testEvent = {
                Records: [
                    {
                        "body": "{\n  \"priv_collector_state\": {\n    \"since\": \"123\",\n    \"until\": \"321\"\n  }\n}",
                        "eventSourceARN": "arn:aws:sqs:us-east-1:352283894008:test-queue",
                    }
                ]
            };
            
            TestCollectorMultiState.load().then(function(creds) {
                var collector = new TestCollectorMultiState(ctx, creds);
                collector.handleEvent(testEvent);
            });
        });

        it('sends multiple SQS batches when greater than len privCollectorStates is > 10', function(done) {

            let ctx = {
                invokedFunctionArn : pawsMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };

            let privCollectorStates = gen_state_objects(72);

            let initialPawsState = {
                priv_collector_state: privCollectorStates
            };

            TestCollectorMultiState.load().then(function(creds) {
                let collector = new TestCollectorMultiState(ctx, creds);
                collector._storeCollectionState(initialPawsState, privCollectorStates, 0, err => {
                    assert.equal(sqsSendMessageBatchStub.callCount, 8);
                    done();
                });
            });
        });
        
        it('Process the logs in batch if logs size >10000', function (done) {
            mockDDB();
            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    sinon.assert.calledThrice(mockSendLogmsgs);
                    sinon.assert.calledThrice(mockSendLmcstats);
                    restoreDDB();
                    done();
                }
            };
            let mockSendLogmsgs = sinon.stub(m_alCollector.IngestC.prototype, 'sendLogmsgs').callsFake(
                function fakeFn(data, callback) {
                    return new Promise(function (resolve, reject) {
                        resolve(null);
                    });
                });

            let mockSendLmcstats = sinon.stub(m_alCollector.IngestC.prototype, 'sendLmcstats').callsFake(
                function fakeFn(data, callback) {
                    return new Promise(function (resolve, reject) {
                        resolve(null);
                    });
                });
            const testEvent = {
                Records: [
                    {
                        "body": "{\n  \"priv_collector_state\": {\n    \"since\": \"2021-07-01T02:37:37.617Z\",\n    \"until\": \"2021-07-01T03:37:37.617Z\"\n  }\n}",
                        "md5OfBody": "5d172f741470c05e3d2a45c8ffcd9ab3",
                        "messageId": "5fea7756-0ea4-451a-a703-a558b933e274",
                        "eventSourceARN": "arn:aws:sqs:us-east-1:352283894008:test-queue",
                    }
                ]
            };
                TestMaxLogSizeCollector.load().then(function (creds) {
                var collector = new TestMaxLogSizeCollector(ctx, creds);
                collector.handleEvent(testEvent);
            });
        });

        it('Check sendCollectorStatus method call only after Five failed attempt', function (done) {
            mockDDB();
            mockCloudWatch();
            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    sinon.assert.callCount(mockSendCollectorStatus, 1);
                    sinon.assert.calledOnce(mockPawsGetLogs);
                    mockPawsGetLogs.restore();
                    mockSendCollectorStatus.restore();
                    pawsStub.restore(CloudWatch, 'putMetricData');
                    restoreDDB();
                    done();
                },
                getRemainingTimeInMillis: function(){
                    return moment().valueOf();
                }
            };
            let mockSendCollectorStatus = sinon.stub(m_al_aws.AlAwsCollector.prototype, 'sendCollectorStatus').callsFake(
                function fakeFn(stream,status, callback) {
                    return callback(null);
                });

            let mockPawsGetLogs = sinon.stub(TestCollector.prototype, "pawsGetLogs").callsFake(
                function fakeFn(state, callback) {
                    return callback({ name: 'OktaApiError', status: 401, errorCode: 'E0000011', errorSummary: 'Invalid token provided' });
                });
            const testEvent = {
                Records: [
                    {
                        "body": "{\n  \"priv_collector_state\": {\n    \"since\": \"2021-07-01T02:37:37.617Z\",\n    \"until\": \"2021-07-01T03:37:37.617Z\"\n  }\n, \"retry_count\":4}",
                        "md5OfBody": "5d172f741470c05e3d2a45c8ffcd9ab3",
                        "messageId": "5fea7756-0ea4-451a-a703-a558b933e274",
                        "eventSourceARN": "arn:aws:sqs:us-east-1:352283894008:test-queue",
                    }
                ]
            };
            TestCollector.load().then(function (creds) {
                var collector = new TestCollector(ctx, creds);
                collector.handleEvent(testEvent);
            });
        });

        it('Check sendCollectorStatus method not call if failed attempt less < 5', function (done) {
            mockDDB();
            mockCloudWatch();
            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    sinon.assert.callCount(mockSendCollectorStatus, 0);
                    sinon.assert.calledOnce(mockPawsGetLogs);
                    mockPawsGetLogs.restore();
                    mockSendCollectorStatus.restore();
                    pawsStub.restore(CloudWatch, 'putMetricData');
                    restoreDDB();
                    done();
                },
                getRemainingTimeInMillis: function(){
                    return moment().valueOf();
                }
            };
            let mockSendCollectorStatus = sinon.stub(m_al_aws.AlAwsCollector.prototype, 'sendCollectorStatus').callsFake(
                function fakeFn(stream,status, callback) {
                    return callback(null);
                });

            let mockPawsGetLogs = sinon.stub(TestCollector.prototype, "pawsGetLogs").callsFake(
                function fakeFn(state, callback) {
                    return callback({ name: 'OktaApiError', status: 401, errorCode: 'E0000011', errorSummary: 'Invalid token provided' });
                });
            const testEvent = {
                Records: [
                    {
                        "body": "{\n  \"priv_collector_state\": {\n    \"since\": \"2021-07-01T02:37:37.617Z\",\n    \"until\": \"2021-07-01T03:37:37.617Z\"\n  }\n, \"retry_count\":3}",
                        "md5OfBody": "5d172f741470c05e3d2a45c8ffcd9ab3",
                        "messageId": "5fea7756-0ea4-451a-a703-a558b933e274",
                        "eventSourceARN": "arn:aws:sqs:us-east-1:352283894008:test-queue",
                    }
                ]
            };
            TestCollector.load().then(function (creds) {
                var collector = new TestCollector(ctx, creds);
                collector.handleEvent(testEvent);
            });
        });

        it('Check if retry_count get added in state for existing collector and it will not call mockSendCollectorStatus method', function (done) {
            mockDDB();
            mockCloudWatch();
            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    sinon.assert.callCount(mockSendCollectorStatus, 0);
                    sinon.assert.calledOnce(mockPawsGetLogs);
                    mockPawsGetLogs.restore();
                    mockSendCollectorStatus.restore();
                    pawsStub.restore(CloudWatch, 'putMetricData');
                    restoreDDB();
                    done();
                },
                getRemainingTimeInMillis: function(){
                    return moment().valueOf();
                }
            };
            let mockSendCollectorStatus = sinon.stub(m_al_aws.AlAwsCollector.prototype, 'sendCollectorStatus').callsFake(
                function fakeFn(stream, status, callback) {
                    return callback(null);
                });

            let mockPawsGetLogs = sinon.stub(TestCollector.prototype, "pawsGetLogs").callsFake(
                function fakeFn(state, callback) {
                    return callback({ name: 'OktaApiError', status: 401, errorCode: 'E0000011', errorSummary: 'Invalid token provided' });
                });
            const testEvent = {
                Records: [
                    {
                        "body": "{\n  \"priv_collector_state\": {\n    \"since\": \"2021-07-01T02:37:37.617Z\",\n    \"until\": \"2021-07-01T03:37:37.617Z\"\n  }\n}",
                        "md5OfBody": "5d172f741470c05e3d2a45c8ffcd9ab3",
                        "messageId": "5fea7756-0ea4-451a-a703-a558b933e274",
                        "eventSourceARN": "arn:aws:sqs:us-east-1:352283894008:test-queue",
                    }
                ]
            };
            TestCollector.load().then(function (creds) {
                var collector = new TestCollector(ctx, creds);
                collector.handleEvent(testEvent);
                
            });
        });

        it('Check body encoding error is handle by uploading the file in s3 bucket and collector return new state', function (done) {
            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    sinon.assert.calledOnce(processLog);
                    done();
                }
            };
            const ingestError = {
                errorCode: 'AWSC0018',
                message: "AWSC0018 failed at logmsgs : 401 - \"{\\\"error\\\":\\\"body encoding invalid\\\"}",
                httpErrorCode: 400
            };
            let processLog = sinon.stub(m_al_aws.AlAwsCollector.prototype, 'processLog').callsFake(
                function fakeFn(messages, formatFun, hostmetaElems, callback) {
                    return callback(ingestError);
                });

            let uploadS3ObjectMock = sinon.stub(m_al_aws.Util, 'uploadS3Object').callsFake(
                function fakeFn(params, callback) {
                    return callback(null);
                });


            pawsStub.mock(CloudWatch, 'putMetricData', (params, callback) => callback());

            TestCollector.load().then(function (creds) {
                var collector = new TestCollector(ctx, creds);
                const nextState = { state: 'new-state' };
                collector.batchLogProcess(['log1', 'log2'], nextState, 900, (err, newState, nextinvocationTimeout) => {
                    sinon.assert.calledOnce(uploadS3ObjectMock);
                    assert.equal(newState, nextState);
                    assert.equal(nextinvocationTimeout, 900);
                    pawsStub.restore(CloudWatch, 'putMetricData');
                    processLog.restore();
                    uploadS3ObjectMock.restore();
                    done();
                });
            });
        });

        it('Throw the other ingest error except body encoding invalid', function (done) {
            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    sinon.assert.calledOnce(processLog);
                    done();
                }
            };
            const ingestError = {
                errorCode: 'AWSC0018',
                message: "AWSC0018 failed at logmsgs :  404 - \"{\"error\":\"Customer Not Active in AIMS\"}",
                httpErrorCode: 404
            };
            let processLog = sinon.stub(m_al_aws.AlAwsCollector.prototype, 'processLog').callsFake(
                function fakeFn(messages, formatFun, hostmetaElems, callback) {
                    return callback(ingestError);
                });
            pawsStub.mock(CloudWatch, 'putMetricData', (params, callback) => callback());

            TestCollector.load().then(function (creds) {
                var collector = new TestCollector(ctx, creds);
                const nextState = { state: 'new-state' };
                collector.batchLogProcess(['log1', 'log2'], nextState, 900, (err, res) => {
                    assert.equal(err.errorCode, 'AWSC0018');
                    assert.equal(err.httpErrorCode, 404);
                    processLog.restore();
                    pawsStub.restore(CloudWatch,'putMetricData');
                    done();
                });
            });
        });
        it('reportApiThrottling', function(done) {
            let ctx = {
                invokedFunctionArn : pawsMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            pawsStub.mock(CloudWatch, 'putMetricData', (params, callback) => callback());
            TestCollector.load().then(function(creds) {
                var collector = new TestCollector(ctx, creds);
                collector.reportApiThrottling(function(error) {
                    assert.equal(null, error);
                    pawsStub.restore(CloudWatch,'putMetricData');
                    done();
                });
            });
        });

        it('sets the secret param properly', (done) => {
            let ctx = {
                invokedFunctionArn : pawsMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };

            pawsStub.restore(KMS,'encrypt');

            pawsStub.mock(SSM, 'putParameter', (params, callback) => callback(null, {Version: 2, Tier:'Standard'}));

            pawsStub.mock(KMS, 'encrypt', function (params, callback) {
                const data = {
                    CiphertextBlob :  Buffer.from(params.Plaintext,'base64')
                };
                return callback(null, data);
            });

            TestCollector.load().then(function(creds) {
                const collector = new TestCollector(ctx, creds);
                const secretValue = 'a-secret';
                collector.setPawsSecret(secretValue).then((res) => {
                    assert.equal(res.Version, 2);
                    assert.equal(res.Tier, 'Standard');
                    pawsStub.restore(SSM,'putParameter');
                    done();
                });
            });
        });

        it('reportCollectionDelay', function(done) {
            let ctx = {
                invokedFunctionArn : pawsMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };

            pawsStub.mock(CloudWatch, 'putMetricData', (params, callback) => callback());
            TestCollector.load().then(function(creds) {
                var collector = new TestCollector(ctx, creds);
                collector.reportCollectionDelay('2020-01-26T12:08:31.316Z', function(error) {
                    assert.equal(null, error);
                    pawsStub.restore(CloudWatch,'putMetricData');
                    done();
                });
            });
        });

        it('reportClientError', function(done) {
            let ctx = {
                invokedFunctionArn : pawsMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };

            let errorObj = {name:'OktaApiError',status: 401,errorCode:'E0000011',errorSummary:'Invalid token provided'};
            pawsStub.mock(CloudWatch, 'putMetricData', (params, callback) => callback());
            TestCollector.load().then(function(creds) {
                var collector = new TestCollector(ctx, creds);
                collector.reportClientError(errorObj, function(error) {
                    assert.equal(errorObj.errorCode, 'E0000011');
                    pawsStub.restore(CloudWatch, 'putMetricData');
                    done();
                });
            });
        });
        it('reportErrorToIngestApi', function(done) {
            let ctx = {
                invokedFunctionArn : pawsMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
    
            let errorObj = {name:'StatusCodeError',statusCode: 401,errorCode:'E0000011',message: '401 - undefined'};
            pawsStub.mock(CloudWatch, 'putMetricData', (params, callback) => callback());
            TestCollector.load().then(function(creds) {
                var collector = new TestCollector(ctx, creds);
                collector.reportErrorToIngestApi(errorObj, function(error) {
                    assert.equal(errorObj.errorCode, 'E0000011');
                    assert.equal(null, error);
                    pawsStub.restore(CloudWatch,'putMetricData');
                    done();
                });
            });
        });

        it('reportDuplicateLogCount', function(done) {
            let ctx = {
                invokedFunctionArn : pawsMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };

            pawsStub.mock(CloudWatch, 'putMetricData', (params, callback) => {
                callback(null, {});
            });
              
            TestCollector.load().then(function(creds) {
                var collector = new TestCollector(ctx, creds);
                collector.reportDuplicateLogCount(6, function(error) {
                    assert.equal(null, error);
                    pawsStub.restore(CloudWatch,'putMetricData');
                    done();
                });
            });
        });

        it('reportCollectorStatus', function(done) {
            let ctx = {
                invokedFunctionArn : pawsMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            pawsStub.mock(CloudWatch, 'putMetricData', (params, callback) => callback());
            TestCollector.load().then(function(creds) {
                var collector = new TestCollector(ctx, creds);
                const status = 'ok';
                collector.reportCollectorStatus(status, function(error) {
                    assert.equal(null, error);
                    pawsStub.restore(CloudWatch,'putMetricData');
                    done();
                });
            });
        });
    });
    
    describe('Register Tests', function() {
        it('Register success', function(done) {
            let ctx = {
                invokedFunctionArn : pawsMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };

            const testEvent = {
                "RequestType": "Create",
                "ServiceToken": "arn:aws:lambda:eu-west-1:352283894008:function:username-test-remov-GetEndpointsLambdaFuncti-RVS9Y1YR1GJR",
                "ResponseURL": "https://cloudformation-custom-resource-response-euwest1.s3-eu-west-1.amazonaws.com/arn%3Aaws%3Acloudformation%3Aeu-west-1%3A352283894008%3Astack/username-test-removed-creds-4/b8d29ba0-c499-11e7-a296-503abe701cd1%7CEndpointAPIs%7Cf0e0cab3-b258-4058-b56a-820c76ff30a5?AWSAccessKeyId=AKIAJ7MCS7PVEUOADEEA&Expires=1510162268&Signature=i83yhDz11gTyT4ACewvG6yKRjp4%3D",
                "StackId": "arn:aws:cloudformation:eu-west-1:352283894008:stack/username-test-removed-creds-4/b8d29ba0-c499-11e7-a296-503abe701cd1",
                "RequestId": "f0e0cab3-b258-4058-b56a-820c76ff30a5",
                "LogicalResourceId": "EndpointAPIs",
                "ResourceType": "AWS::CloudFormation::CustomResource",
                "ResourceProperties": {
                    "ServiceToken": "arn:aws:lambda:eu-west-1:352283894008:function:username-test-remov-GetEndpointsLambdaFuncti-RVS9Y1YR1GJR",
                    "StackName": "username-test-1",
                    "AwsAccountId": "352283894008",
                    "VpcId" : "vpc-id",
                    "LogGroup" : "log-group-name"
                }
            };
            
            PawsCollector.load().then((creds) => {
                var collector = new TestCollector(ctx, creds);
                collector.handleEvent(testEvent);
            });
        });
    });
    
    describe('Format Log Tests', function(){
        it('Format success', function(done) {
            let ctx = {
                invokedFunctionArn : pawsMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                },
                succeed : function() {
                }
            };
            
            const formattedMsg = {
                messageTs: 12345678,
                priority: 11,
                progName: 'OktaCollector',
                message: '"test"',
                messageType: 'json/aws.test',
                applicationId: 'paws'
            };
            
            TestCollector.load().then((creds) => {
            let collector = new TestCollector(ctx, creds);
            let bindFormat = collector.pawsFormatLog.bind(collector);
            const returned = bindFormat("test");
            assert.deepEqual(returned, formattedMsg);
            done();
            });
        });
        it('Format throw', function(done) {
            let ctx = {
                invokedFunctionArn : pawsMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                },
                succeed : function() {
                }
            };
            PawsCollector.load().then((creds) => {
            var collector = new TestCollectorNoOverrides(ctx, creds);
            assert.throws(function() {collector.pawsFormatLog("test");}, Error);
            done();
            });
        });
    });
    
    describe('Get Log Tests', function(){
        it('Get Log success', function(done) {
            let ctx = {
                invokedFunctionArn : pawsMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
        
            const callbackStub = sinon.spy(TestCollector.prototype, "pawsGetLogs");
            var aimsCreds = pawsMock.AIMS_TEST_CREDS;
            var pawsCreds = pawsMock.PAWS_TEST_CREDS;
            var collector = new TestCollector(ctx, {aimsCreds, pawsCreds});
            const mockState = {state: 'initial-state'};
            collector.pawsGetLogs(mockState, (error, logs, newState, newTimeout) => {
                assert.ok(callbackStub.called);
                assert.equal(error, null);
                assert.equal(logs.length, 2);
                assert.deepEqual(newState, {state: 'new-state'});
                assert.equal(newTimeout, 900);
                callbackStub.restore();
                done();
            });
        });
        it('Get Log throw', function(done){
            let ctx = {
                invokedFunctionArn : pawsMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                },
                succeed : function() {    
                }
            };
            
            const state = {state: 'initial-state'};
            const callbackStub = sinon.stub(TestCollector.prototype, "pawsGetLogs");
            PawsCollector.load().then((creds) => {
                var collector = new TestCollectorNoOverrides(ctx, creds);
                assert.throws(function() {collector.pawsGetLogs(state, callbackStub);}, Error);
                done();
            });
        });    
    });
    describe('Init Collection Tests', function(){
        it('Init Collection State success', function(done){
            let ctx = {
                invokedFunctionArn : pawsMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                },
                succeed : function() {
                }
            };
            const testEvent = {"event": "create"};
            const callbackStub = sinon.spy(TestCollector.prototype, "pawsInitCollectionState");
            PawsCollector.load().then((creds) => {
                var collector = new TestCollector(ctx, creds);
                collector.pawsInitCollectionState(testEvent, (error, newState, newTimeout) => {
                    assert.ok(callbackStub.called);
                    assert.equal(error, null);
                    assert.deepEqual(newState, {state: 'initial-state'});
                    assert.equal(newTimeout, 900);
                    callbackStub.restore();
                    done();
                });
            });
        });
        it('Init Collection State throw', function(done){
            let ctx = {
                invokedFunctionArn : pawsMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                },
                succeed : function(){
                }
            };
            
            const testEvent = {"event" : "create"};
            const callbackStub = sinon.stub(TestCollector.prototype, "pawsInitCollectionState");
            PawsCollector.load().then((creds) => {
                var collector = new TestCollectorNoOverrides(ctx, creds);
                assert.throws( function() {collector.pawsInitCollectionState(testEvent, callbackStub);}, Error);
                done();
            });
        });
    });
    describe('Get Register Parameters Tests', function(){
        it('Get Register Parameters populated', function(done){
            let ctx = {
                invokedFunctionArn : pawsMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                },
                succeed : function(){
                }
            };
            
            const testEvent = {"event" : "create"};
            PawsCollector.load().then((creds) => {
                var collector = new TestCollector(ctx, creds);
                collector.pawsGetRegisterParameters(testEvent, (error, objectWithRegistrationProperties) =>{
                    assert.equal(error, null);
                    assert.deepEqual(objectWithRegistrationProperties, {register: 'test-param'});
                    done();
                });
            });
        });
        it('Get Register Parameters empty', function(done){
            let ctx = {
                invokedFunctionArn : pawsMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                },
                succeed : function(){
                }
            };
            
            const testEvent = {"event" : "create"};
            PawsCollector.load().then((creds) => {
                var collector = new TestCollectorNoOverrides(ctx, creds);
                collector.pawsGetRegisterParameters(testEvent, (error, objectWithRegistrationProperties) =>{
                    assert.equal(error, null);
                    assert.deepEqual(objectWithRegistrationProperties, {});
                    done();
                });
            });
        });
    });

    describe('removeDuplicatedItem', function () {
        afterEach(function () {
           restoreDDB();       
        });
        it('Added the data if item not exist', function (done) {
            const fakeFun = function (_params, callback) { return callback(null, { data: null }); };
            const putItemStub = sinon.stub().callsFake(fakeFun);
            mockDDB(null, putItemStub, null);

            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    const putItemArgs = putItemStub.args[0][0];
                    assert.equal(putItemArgs.called, true, 'should added the item');
                    assert.equal(putItemArgs.Key.Id.S, "c5d8e7ea-90b0-4549-9746-f67c8f6c00");
                    done();
                }
            };

            PawsCollector.load().then((creds) => {
                var collector = new TestCollectorNoOverrides(ctx, creds);
                collector.removeDuplicatedItem(pawsMock.MOCK_LOGS, 'Id', (error, uniqueLogs) => {
                    assert.equal(error, null);
                    assert.deepEqual(uniqueLogs.length, pawsMock.MOCK_LOGS.length);
                    done();
                });
            });
        });

        it('Discard record if it is duplicate', function (done) {
            const ddbError = {
                "message": "The conditional request failed",
                "name": "ConditionalCheckFailedException",
                "time": "2021-09-01T12:34:56.789Z",
                "requestId": "12345678-1234-1234-1234-123456789012",
                "statusCode": 400,
                "retryable": false
            };
            const putItemStub = sinon.stub().callsFake(
                function (_params, callback) {
                    return callback(ddbError);
                });

            mockDDB(null, putItemStub, null);

            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    const putItemArgs = putItemStub.args[0][0];
                    assert.equal(putItemArgs.called, true, 'should added the item');
                    assert.equal(putItemArgs.Key.Id.S, "c5d8e7ea-90b0-4549-9746-f67c8f6c00");
                    done();
                }
            };
            pawsStub.mock(CloudWatch, 'putMetricData', (params, callback) => callback(null));
            PawsCollector.load().then((creds) => {
                var collector = new TestCollectorNoOverrides(ctx, creds);
                collector.removeDuplicatedItem(pawsMock.MOCK_LOGS, 'Id', (error, uniqueLogs) => {
                    assert.equal(error, null);
                    assert.equal(uniqueLogs.length, 0);
                    pawsStub.restore(CloudWatch, 'putMetricData');
                    done();
                });
            });
        });

        it('Added only not existing item and discard duplicate item', function (done) {
            let ddbError = {
                "message": "The conditional request failed",
                "name": "ConditionalCheckFailedException",
                "time": "2021-09-01T12:34:56.789Z",
                "requestId": "12345678-1234-1234-1234-123456789012",
                "statusCode": 400,
                "retryable": false
            };
            const fakeFunError = function (_params, callback) {
                return callback(ddbError);
            };
            const fakeFunSuccess = function (_params, callback) {
                return callback(null, { data: null });
            };
            let putItemStub = sinon.stub().onFirstCall().callsFake(fakeFunError)
                .onSecondCall().callsFake(fakeFunSuccess);

            mockDDB(null, putItemStub, null);
            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    const putItemArgs = putItemStub.args[0][0];
                    assert.equal(putItemArgs.called, true, 'should added the item');
                    assert.equal(putItemArgs.Key.Id.S, "c5d8e7ea-90b0-4549-9746-f67c8f6c00");
                    done();
                }
            };
            pawsStub.mock(CloudWatch, 'putMetricData', (params, callback) => callback(null));
            PawsCollector.load().then((creds) => {
                var collector = new TestCollectorNoOverrides(ctx, creds);
                collector.removeDuplicatedItem(pawsMock.MOCK_LOGS, 'Id', (error, uniqueLogs) => {
                    assert.equal(error, null);
                    assert.equal(uniqueLogs.length, 1);
                    pawsStub.restore(CloudWatch,'putMetricData');
                    done();
                });
            });
        });

        it('Check if ddb send error except ConditionalCheckFailedException ', function (done) {
            let ddbError = {
                "message": "The level of configured provisioned throughput for the table was exceeded. Consider increasing your provisioning level with the UpdateTable API.",
                "name": "ProvisionedThroughputExceededException",
                "time": "2021-09-01T12:34:56.789Z",
                "requestId": "12345678-1234-1234-1234-123456789012",
                "statusCode": 400,
                "retryable": true
            };
            const fakeFunError = function (_params, callback) {
                return callback(ddbError);
            };
            const fakeFunSuccess = function (_params, callback) {
                return callback(null, { data: null });
            };
            let putItemStub = sinon.stub().onFirstCall().callsFake(fakeFunError)
                .onSecondCall().callsFake(fakeFunSuccess);

            mockDDB(null, putItemStub, null);
            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    const putItemArgs = putItemStub.args[0][0];
                    assert.equal(putItemArgs.called, true, 'should added the item');
                    assert.equal(putItemArgs.Key.Id.S, "c5d8e7ea-90b0-4549-9746-f67c8f6c00");
                    done();
                }
            };
            pawsStub.mock(CloudWatch, 'putMetricData', (params, callback) => callback(null));
            PawsCollector.load().then((creds) => {
                var collector = new TestCollectorNoOverrides(ctx, creds);
                collector.removeDuplicatedItem(pawsMock.MOCK_LOGS, 'Id', (error, uniqueLogs) => {
                    assert.notEqual(error, null);
                    pawsStub.restore(CloudWatch, 'putMetricData');
                    done();
                });
            });
        });
    });

    describe('handle the ingest error for deduplogs for o365 collector', function () {
        afterEach(function () {
           restoreDDB();
        });
        it('delete the item in batches', function (done) {
            const fakeFun = function (_params) {
                return new Promise((resolve, reject) => {
                    resolve(null);
                });
            };
            const batchWriteItemStub = sinon.stub().callsFake(fakeFun);

            mockDDB(null, null, null, batchWriteItemStub);

            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };

            PawsCollector.load().then((creds) => {
                var collector = new TestCollectorNoOverrides(ctx, creds);
                collector.deleteDedupLogItemEntry(pawsMock.MOCK_LOGS, (error) => {
                    assert.equal(error, null);
                    sinon.assert.calledOnce(batchWriteItemStub);
                    done();
                });
            });
        });

        it('if data is more the ddb batch size and batch size byte, it should split into different batchs', function (done) {
            const fakeFun = function (_params) {
                return new Promise((resolve, reject) => {
                    resolve(null);
                });
            };
            const batchWriteItemStub = sinon.stub().callsFake(fakeFun);
            mockDDB(null, null, null, batchWriteItemStub);
            const logs = [];
            for (let i = 0; i < 30; i++) {
                pawsMock.MOCK_LOGS[0].Id = pawsMock.MOCK_LOGS[0].Id + i;
                logs.push(pawsMock.MOCK_LOGS[0]);
            }

            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };

            PawsCollector.load().then((creds) => {
                var collector = new TestCollectorNoOverrides(ctx, creds);
                collector.deleteDedupLogItemEntry(logs, (error) => {
                    assert.equal(error, null);
                    sinon.assert.calledTwice(batchWriteItemStub);
                    done();
                });
            });
        });

        it('it should return the error if fail to processed the item ', function (done) {
            let ddbError = {
                "message": "The level of configured provisioned throughput for the table was exceeded. Consider increasing your provisioning level with the UpdateTable API.",
                "name": "ProvisionedThroughputExceededException",
                "time": "2021-09-01T12:34:56.789Z",
                "requestId": "12345678-1234-1234-1234-123456789012",
                "statusCode": 400,
                "retryable": true
            };
            const fakeFunError = function (_params) {
                return new Promise((resolve, reject) => {
                    reject(ddbError);
                });
            };
            const fakeFunSuccess = function (_params) {
                return new Promise((resolve, reject) => {
                    resolve(null);
                });
            };
            let batchWriteItemStub = sinon.stub().onFirstCall().callsFake(fakeFunError)
                .onSecondCall().callsFake(fakeFunSuccess);

            mockDDB(null, null, null, batchWriteItemStub);

            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    const batchWriteItemArgs = batchWriteItemStub.args[0][0];
                    assert.equal(batchWriteItemArgs.called, true, 'should delete the item');
                    done();
                }
            };

            PawsCollector.load().then((creds) => {
                var collector = new TestCollectorNoOverrides(ctx, creds);
                collector.deleteDedupLogItemEntry(pawsMock.MOCK_LOGS, (error) => {
                    assert.notEqual(error, null);
                    sinon.assert.calledOnce(batchWriteItemStub);
                    done();
                });
            });
        });

        it('Check if ingest error occure for collector type o365, it should delete the item entry for failed message from ddb', function (done) {
            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };

            process.env.paws_type_name = 'o365';
            const ingestError = {
                errorCode: 'AWSC0018',
                message: "AWSC0018 failed at logmsgs : 307 - \"{\\\"error\\\":\\\"temporary redirect\\\"}",
                httpErrorCode: 307
            };
            const fakeFunError = function (messages, formatFun, hostmetaElems, callback) {
                return callback(ingestError);
            };
            const fakeFunSuccess = function (messages, formatFun, hostmetaElems, callback) {
                return callback(null, { data: null });
            };

            let processLog = sinon.stub(m_al_aws.AlAwsCollector.prototype, 'processLog').onFirstCall().callsFake(fakeFunSuccess)
                .onSecondCall().callsFake(fakeFunSuccess).onThirdCall().callsFake(fakeFunError);

            pawsStub.mock(CloudWatch, 'putMetricData', (params, callback) => callback());

            const fakeFun = function (_params) {
                return new Promise((resolve, reject) => {
                    resolve(null);
                });
            };
            const batchWriteItemStub = sinon.stub().callsFake(fakeFun);

            mockDDB(null, null, null, batchWriteItemStub);

            TestCollector.load().then(function (creds) {
                var collector = new TestCollector(ctx, creds);
                const nextState = { state: 'new-state' };
                const logs = [];
                for (let i = 0; i < 20100; i++) {
                    logs.push('log' + Math.random());
                }
                collector.batchLogProcess(logs, nextState, 900, (err, newState, nextinvocationTimeout) => {
                    sinon.assert.calledThrice(processLog);
                    sinon.assert.callCount(batchWriteItemStub, 4);
                    assert.equal(ingestError, err);
                    pawsStub.restore(CloudWatch, 'putMetricData');
                    processLog.restore();
                    done();
                });
            });
        });

        it('If collector type other than o365 then it shoud return the same error', function (done) {
            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };

            process.env.paws_type_name = 'okta';
            const ingestError = {
                errorCode: 'AWSC0018',
                message: "AWSC0018 failed at logmsgs : 307 - \"{\\\"error\\\":\\\"temporary redirect\\\"}",
                httpErrorCode: 307
            };

            const fakeFunError = function (messages, formatFun, hostmetaElems, callback) {
                return callback(ingestError);
            };
            const fakeFunSuccess = function (messages, formatFun, hostmetaElems, callback) {
                return callback(null, { data: null });
            };

            let processLog = sinon.stub(m_al_aws.AlAwsCollector.prototype, 'processLog').onFirstCall().callsFake(fakeFunSuccess)
                .onSecondCall().callsFake(fakeFunSuccess).onThirdCall().callsFake(fakeFunError);

            pawsStub.mock(CloudWatch, 'putMetricData', (params, callback) => callback());

            const fakeFun = function (_params) {
                return new Promise((resolve, reject) => {
                    resolve(null);
                });
            };
            const batchWriteItemStub = sinon.stub().callsFake(fakeFun);

            mockDDB(null, null, null, batchWriteItemStub);

            TestCollector.load().then(function (creds) {
                var collector = new TestCollector(ctx, creds);
                const nextState = { state: 'new-state' };
                const logs = [];
                for (let i = 0; i < 20050; i++) {
                    logs.push('log' + Math.random());
                }
                collector.batchLogProcess(logs, nextState, 900, (err, newState, nextinvocationTimeout) => {
                    sinon.assert.calledThrice(processLog);
                    sinon.assert.callCount(batchWriteItemStub, 0);
                    assert.equal(ingestError, err);
                    pawsStub.restore(CloudWatch, 'putMetricData');
                    processLog.restore();
                    done();
                });
            });
        });
    });
});

