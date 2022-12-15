const fs = require('fs');
const assert = require('assert');
const sinon = require('sinon');
var AWS = require('aws-sdk-mock');
const m_response = require('cfn-response');
const ddLambda = require('datadog-lambda-js');

const pawsMock = require('./paws_mock');
var m_alCollector = require('@alertlogic/al-collector-js');
var PawsCollector = require('../paws_collector').PawsCollector;
const m_al_aws = require('@alertlogic/al-aws-collector-js');

var alserviceStub = {};
var responseStub = {};
var setEnvStub = {};



function setAlServiceStub() {
    alserviceStub.get = sinon.stub(m_alCollector.AlServiceC.prototype, 'get').callsFake(
        function fakeFn(path, extraOptions) {
            return new Promise(function(resolve, reject) {
                var ret = null;
                switch (path) {
                    case '/residency/default/services/ingest/endpoint':
                        ret = {
                            ingest : 'new-ingest-endpoint'
                    };
                        break;
                case '/residency/default/services/azcollect/endpoint':
                    ret = {
                        azcollect : 'new-azcollect-endpoint'
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
    AWS.mock('SQS', 'sendMessage', function (params, callback) {
        let buf = Buffer(JSON.stringify(returnObject));
        return callback(null, {Body: buf});
    });
}

function mockSQSSendMessageBatch(returnObject) {
    AWS.mock('SQS', 'sendMessageBatch', function (params, callback) {
        let buf = Buffer(JSON.stringify(returnObject));
        return callback(null, {Body: buf});
    });
}

function mockDDB(getItemStub, putItemStub, updateItemStub){
    const defaultMock = (_params, callback) => {
        return callback(null, {data: null});
    };

    AWS.mock('DynamoDB', 'getItem', getItemStub ? getItemStub : defaultMock);

    AWS.mock('DynamoDB', 'putItem', putItemStub ? putItemStub : defaultMock);

    AWS.mock('DynamoDB', 'updateItem', updateItemStub ? updateItemStub : defaultMock);
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
        AWS.mock('KMS', 'decrypt', function (params, callback) {
            const data = {
                    Plaintext : 'decrypted-sercret-key'
                };
            return callback(null, data);
        });

        AWS.mock('KMS', 'encrypt', function (params, callback) {
            const data = {
                CiphertextBlob : Buffer.from('creds-from-file')
            };
            return callback(null, data);
        });

        AWS.mock('SSM', 'getParameter', function (params, callback) {
            const data = process.env.ssm_direct ? 'decrypted-sercret-key': Buffer.from('decrypted-sercret-key');
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
        AWS.restore('KMS');
        AWS.restore('SSM');
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
            AWS.restore('DynamoDB');
        });
        it('creates a new DDB item when the states does not exist', function(done){
            const fakeFun = function(_params, callback){return callback(null, {data:null});};
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
            const fakeGetFun = function (_params, callback) {
                const mockItem = {
                    Item: {
                        MessageId: { S: mockRecord.messageId },
                        Status: {S: 'COMPLETE'},
                        Updated: {N: `${Date.now()/1000 - 100 }`}
                    }
                };
                return callback(null, mockItem);
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
            const fakeGetFun = function (_params, callback) {
                const mockItem = {
                    Item: {
                        MessageId: { S: mockRecord.messageId },
                        Status: {S: 'INCOMPLETE'},
                        Updated: {N: `${Date.now()/1000 - 100 }`}
                    }
                };
                return callback(null, mockItem);
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
                    AWS.restore('DynamoDB');
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
                    AWS.restore('DynamoDB');
                    sinon.assert.calledOnce(updateItemStub);
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
                collector.mockGetLogsError = 'Error getting logs';
                collector.handleEvent(testEvent);
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
                    AWS.restore('DynamoDB');
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

            let buf = Buffer(JSON.stringify({}));
            let spy = sinon.spy((params, callback) => callback(null, {Body: buf}));
            AWS.remock('SQS', 'sendMessageBatch', spy);

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
                    assert.equal(spy.callCount, 8);
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

        it('Check sendStatus method call only after Five failed attempt', function (done) {
            mockDDB();
            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    sinon.assert.callCount(mockSendStatus, 1);
                    sinon.assert.calledOnce(mockPawsGetLogs);
                    mockPawsGetLogs.restore();
                    mockSendStatus.restore();
                    done();
                }
            };
            let mockSendStatus = sinon.stub(m_al_aws.AlAwsCollector.prototype, 'sendStatus').callsFake(
                function fakeFn(status, callback) {
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

        it('Check sendStatus method not call if failed attempt less < 5', function (done) {
            mockDDB();
            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    sinon.assert.callCount(mockSendStatus, 0);
                    sinon.assert.calledOnce(mockPawsGetLogs);
                    mockPawsGetLogs.restore();
                    mockSendStatus.restore();
                    done();
                }
            };
            let mockSendStatus = sinon.stub(m_al_aws.AlAwsCollector.prototype, 'sendStatus').callsFake(
                function fakeFn(status, callback) {
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

        it('Check if retry_count get added in state for existing collector and it will not call sendStatus method', function (done) {
            mockDDB();
            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    sinon.assert.callCount(mockSendStatus, 0);
                    sinon.assert.calledOnce(mockPawsGetLogs);
                    mockPawsGetLogs.restore();
                    mockSendStatus.restore();
                    done();
                }
            };
            let mockSendStatus = sinon.stub(m_al_aws.AlAwsCollector.prototype, 'sendStatus').callsFake(
                function fakeFn(status, callback) {
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
        it('Extract the error code from ingest error message', function (done) {
            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    sinon.assert.calledOnce(processLog);
                    processLog.restore();
                    done();
                }
            };
            let ingestError = "AWSC0018 failed to send the logmsgs : 404 - \"{\"error\":\"Customer Not Active in AIMS\"}";
            let processLog = sinon.stub(m_al_aws.AlAwsCollector.prototype, 'processLog').callsFake(
                function fakeFn(messages, formatFun, hostmetaElems, callback) {
                    return callback(ingestError);
                });

            AWS.mock('CloudWatch', 'putMetricData', (params, callback) => callback());
            TestCollector.load().then(function (creds) {
                var collector = new TestCollector(ctx, creds);
                collector.batchLogProcess(['log1', 'log2'], { state: 'new-state' }, 900, (err, res) => {
                    assert.equal(ingestError, err);
                    AWS.restore('CloudWatch');
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
            AWS.mock('CloudWatch', 'putMetricData', (params, callback) => callback());
            TestCollector.load().then(function(creds) {
                var collector = new TestCollector(ctx, creds);
                collector.reportApiThrottling(function(error) {
                    assert.equal(null, error);
                    AWS.restore('KMS');
                    AWS.restore('CloudWatch');
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

            AWS.restore('KMS');

            AWS.mock('SSM', 'putParameter', (params, callback) => callback(null, {Version: 2, Tier:'Standard'}));

            AWS.mock('KMS', 'encrypt', function (params, callback) {
                const data = {
                    CiphertextBlob : params.Plaintext
                };
                return callback(null, data);
            });

            TestCollector.load().then(function(creds) {
                const collector = new TestCollector(ctx, creds);
                const secretValue = 'a-secret';
                collector.setPawsSecret(secretValue).then((res) => {
                    assert.equal(res.Version, 2);
                    assert.equal(res.Tier, 'Standard');
                    AWS.restore('KMS');
                    AWS.restore('SSM');
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

            AWS.mock('CloudWatch', 'putMetricData', (params, callback) => callback());
            TestCollector.load().then(function(creds) {
                var collector = new TestCollector(ctx, creds);
                collector.reportCollectionDelay('2020-01-26T12:08:31.316Z', function(error) {
                    assert.equal(null, error);
                    AWS.restore('KMS');
                    AWS.restore('CloudWatch');
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
            AWS.mock('CloudWatch', 'putMetricData', (params, callback) => callback());
            TestCollector.load().then(function(creds) {
                var collector = new TestCollector(ctx, creds);
                collector.reportClientError(errorObj, function(error) {
                    assert.equal(errorObj.errorCode, 'E0000011');
                    AWS.restore('KMS');
                    AWS.restore('CloudWatch');
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
            AWS.mock('CloudWatch', 'putMetricData', (params, callback) => callback());
            TestCollector.load().then(function(creds) {
                var collector = new TestCollector(ctx, creds);
                collector.reportErrorToIngestApi(errorObj, function(error) {
                    assert.equal(errorObj.errorCode, 'E0000011');
                    assert.equal(null, error);
                    AWS.restore('KMS');
                    AWS.restore('CloudWatch');
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
});

