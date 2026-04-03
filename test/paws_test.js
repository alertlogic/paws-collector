const fs = require('fs');
const assert = require('assert');
const sinon = require('sinon');
const m_response = require('@alertlogic/al-aws-collector-js').CfnResponse;
const ddLambda = require('datadog-lambda-js');

const pawsMock = require('./paws_mock');
var m_alCollector = require('@alertlogic/al-collector-js');
var PawsCollector = require('../paws_collector').PawsCollector;
const m_al_aws = require('@alertlogic/al-aws-collector-js');
const moment = require('moment');
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
                            collector_status: 'new-collector-status-endpoint'
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
                return resolve({});
            });
        });
    alserviceStub.put = sinon.stub(m_alCollector.AlServiceC.prototype, 'put').callsFake(
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
    alserviceStub.put.restore();
}


function mockSetEnvStub() {
    setEnvStub = sinon.stub(m_al_aws.AlAwsCommon, 'setEnvAsync').callsFake((vars) => {
        const {
            ingest_api,
            azcollect_api,
            collector_status_api
        } = vars;
        process.env.ingest_api = ingest_api ? ingest_api : process.env.ingest_api;
        process.env.azcollect_api = azcollect_api ? azcollect_api : process.env.azcollect_api;
        process.env.collector_status_api = collector_status_api ? collector_status_api : process.env.collector_status_api;
        const returnBody = {
            Environment: {
                Variables: vars
            }
        };
        return Promise.resolve(returnBody);
    });
}

function mockSQSSendMessage(returnObject) {
    pawsStub.mock(SQS, 'sendMessage', function(params) {
        let buf = Buffer.from(JSON.stringify(returnObject));
        return Promise.resolve({ Body: buf });
    });
}

function mockSQSSendMessageBatch(returnObject) {
    sqsSendMessageBatchStub = pawsStub.mock(SQS, 'sendMessageBatch', function(params) {
        let buf = Buffer.from(JSON.stringify(returnObject));
        return Promise.resolve({ Body: buf });
    });
}

function mockDDB(getItemStub, putItemStub, updateItemStub, batchWriteItemStub) {

    const promiseMock = (_params) => {
        return new Promise((resolve, reject) => {
            resolve({});
        });
    };

    pawsStub.mock(DynamoDB, 'getItem', getItemStub ? getItemStub : promiseMock);

    pawsStub.mock(DynamoDB, 'putItem', putItemStub ? putItemStub : promiseMock);

    pawsStub.mock(DynamoDB, 'updateItem', updateItemStub ? updateItemStub : promiseMock);

    pawsStub.mock(DynamoDB, 'batchWriteItem', batchWriteItemStub ? batchWriteItemStub : promiseMock);
}

function restoreDDB() {
    // Restore the actual DDB instance stubs
    pawsStub.restore(DynamoDB, 'getItem');
    pawsStub.restore(DynamoDB, 'putItem');
    pawsStub.restore(DynamoDB, 'updateItem');
    pawsStub.restore(DynamoDB, 'batchWriteItem');
}

function mockCloudWatch() {
    pawsStub.mock(CloudWatch, 'putMetricData', (params) => Promise.resolve({
        httpStatusCode: 200,
        requestId: '12345'
    }));
}

function gen_state_objects(num) {
    return new Array(num).fill(0).map((e, i) => ({ state: 'new-state-' + i }));
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
    pawsInitCollectionState(event) {
        return Promise.resolve({ state: 'initial-state', nextInvocationTimeout: 900 });
    }

    pawsGetLogs(state) {
        return Promise.resolve([['log1', 'log2'], { state: 'new-state' }, 900]);
    }

    pawsGetRegisterParameters(event) {
        return { register: 'test-param' };
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

    pawsInitCollectionState(event) {
        return Promise.resolve({ state: 'initial-state', nextInvocationTimeout: 900 });
    }

    pawsGetLogs(state) {
        const logs = [];
        for (let i = 0; i < 25000; i++) {
            logs.push('log' + Math.random());
        }
        return Promise.resolve([logs, { state: 'new-state' }, 900]);
    }

    pawsGetRegisterParameters(event) {
        return { register: 'test-param' };
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

    pawsInitCollectionState(event) {
        return Promise.resolve({ state: 'initial-state-1', nextInvocationTimeout: 900 });
    }

    pawsGetLogs(state) {
        return Promise.resolve([['log1', 'log2'], gen_state_objects(98), 900]);
    }

    pawsGetRegisterParameters(event) {
        return { register: 'test-param' };
    }

    pawsFormatLog(msg) {
        const collector = this;

        let formattedMsg = {
            messageTs: 12345678,
            priority: 11,
            progName: 'OktaCollectorArrayState',
            message: JSON.stringify({ test: 'message' }),
            messageType: 'json/aws.test',
            applicationId: collector.application_id
        };

        return formattedMsg;
    }
}

describe('Unit Tests', function() {
    beforeEach(function() {
        pawsStub.mock(KMS, 'decrypt', function(params) {
            const data = {
                Plaintext: Buffer.from('decrypted-aims-sercret-key')
            };
            return Promise.resolve(data);
        });
        pawsStub.mock(KMS, 'encrypt', function(params) {
            const data = {
                CiphertextBlob: Buffer.from('creds-from-file').toString('base64')
            };
            return Promise.resolve(data);
        });

        pawsStub.mock(SSM, 'getParameter', function(params) {
            const data = process.env.ssm_direct ? 'decrypted-aims-sercret-key' : Buffer.from('decrypted-aims-sercret-key');
            return Promise.resolve({ Parameter: { Value: process.env.ssm_direct ? data : data.toString('base64') } });
        });

        responseStub = sinon.stub(m_response, 'send').callsFake(
            function fakeFn(event, mockContext, responseStatus, responseData, physicalResourceId) {
                return Promise.resolve();
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
        pawsStub.restore(KMS, 'decrypt');
        pawsStub.restore(KMS, 'encrypt');
        pawsStub.restore(SSM, 'getParameter');
        pawsStub.restore(SQS, 'sendMessage');
        sqsSendMessageBatchStub.restore();
        pawsStub.restore(CloudWatch, 'putMetricData');
    });

    describe('Credential file caching tests', function() {
        const TMP_CREDS_PATH = '/tmp/paws_creds';
        it('Gets a creds and set into file', function(done) {
            TestCollector.load().then(function(creds) {
                const testCred = Buffer.from(creds.pawsCreds.secret).toString('base64');
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
    describe('Send DD metric Tests', function() {
        it('sends DD metric', function(done) {
            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {
                    assert.fail(error);
                    done();
                },
                succeed: function() {
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
    describe('State Deduplicationt Tests', function() {
        afterEach(function() {
            restoreDDB();
        });
        it('creates a new DDB item when the states does not exist', async function() {
            const fakeFun = function(_params) { return Promise.resolve({}); };
            const putItemStub = sinon.stub().callsFake(fakeFun);
            const updateItemStub = sinon.stub().callsFake(fakeFun);

            mockDDB(null, putItemStub, updateItemStub);
            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {},
                succeed: function() {}
                
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

            const creds = await TestCollector.load();
            var collector = new TestCollector(ctx, creds);
            await collector.handleEvent(testEvent);

            const putItemArgs = putItemStub.args[0][0];
            const updateItemArgs = updateItemStub.args[0][0];
            assert.equal(putItemStub.called, true, 'should put a new item in');
            assert.equal(updateItemStub.called, true, 'should update the item to complete');
            assert.equal(putItemArgs.Item.MessageId.S, "5fea7756-0ea4-451a-a703-a558b933e274");
            assert.equal(putItemArgs.ConditionExpression, 'attribute_not_exists(CollectorId) AND attribute_not_exists(MessageId)');
            assert.equal(updateItemArgs.Key.MessageId.S, "5fea7756-0ea4-451a-a703-a558b933e274");
        });
        it('handles conditional put race by treating it as duplicate state', async function() {
            const mockRecord = {
                "body": "{\n  \"priv_collector_state\": {\n    \"since\": \"123\",\n    \"until\": \"321\"\n  }\n}",
                "md5OfBody": "5d172f741470c05e3d2a45c8ffcd9ab3",
                "messageId": "5fea7756-0ea4-451a-a703-a558b933e274",
                "eventSourceARN": "arn:aws:sqs:us-east-1:352283894008:test-queue",
            };
            const getItemStub = sinon.stub().callsFake(() => Promise.resolve({}));
            const putItemStub = sinon.stub().callsFake(() => Promise.reject({ name: 'ConditionalCheckFailedException' }));
            const updateItemStub = sinon.stub().callsFake(() => Promise.resolve({ data: null }));

            mockDDB(getItemStub, putItemStub, updateItemStub);

            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: sinon.spy(),
                succeed: sinon.spy()
            };

            const testEvent = {
                Records: [
                    mockRecord
                ]
            };

            const creds = await TestCollector.load();
            var collector = new TestCollector(ctx, creds);
            await collector.handleEvent(testEvent).catch(() => null);

            assert.equal(getItemStub.called, true, 'should read current state record');
            assert.equal(putItemStub.called, true, 'should attempt conditional insert');
            assert.equal(updateItemStub.notCalled, true, 'should not mark duplicate state as complete/failed');
        });
        it('skips the state if it is already completed', async function() {
            const mockRecord = {
                "body": "{\n  \"priv_collector_state\": {\n    \"since\": \"123\",\n    \"until\": \"321\"\n  }\n}",
                "md5OfBody": "5d172f741470c05e3d2a45c8ffcd9ab3",
                "messageId": "5fea7756-0ea4-451a-a703-a558b933e274",
                "eventSourceARN": "arn:aws:sqs:us-east-1:352283894008:test-queue",
            };
            const fakeGetFun = function(_params) {
                return new Promise((resolve, reject) => {
                    const mockItem = {
                        Item: {
                            MessageId: { S: mockRecord.messageId },
                            Status: { S: 'COMPLETE' },
                            Updated: { N: `${Date.now() / 1000 - 100}` }
                        }
                    };
                    resolve(mockItem);
                });
            };
            const fakeFun = function(_params) { return Promise.resolve({ data: null }); };
            const getItemStub = sinon.stub().callsFake(fakeGetFun);
            const putItemStub = sinon.stub().callsFake(fakeFun);
            const updateItemStub = sinon.stub().callsFake(fakeFun);

            mockDDB(getItemStub, putItemStub, updateItemStub);

            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: sinon.spy(),
                succeed: sinon.spy()
            };

            const testEvent = {
                Records: [
                    mockRecord
                ]
            };

            const creds = await TestCollector.load();
            var collector = new TestCollector(ctx, creds);
            await collector.handleEvent(testEvent).catch(() => null);

            assert.equal(getItemStub.called, true, 'should get new item');
            assert.equal(putItemStub.notCalled, true, 'should not put a new item in');
            assert.equal(updateItemStub.notCalled, true, 'should not update the item to complete');
        });
        it('throws an error if the state is bing processed by another invocation', async function() {
            const mockRecord = {
                "body": "{\n  \"priv_collector_state\": {\n    \"since\": \"123\",\n    \"until\": \"321\"\n  }\n}",
                "md5OfBody": "5d172f741470c05e3d2a45c8ffcd9ab3",
                "messageId": "5fea7756-0ea4-451a-a703-a558b933e274",
                "eventSourceARN": "arn:aws:sqs:us-east-1:352283894008:test-queue",
            };
            const fakeGetFun = function(param) {
                const mockItem = {
                    Item: {
                        MessageId: { S: mockRecord.messageId },
                        Status: { S: 'INCOMPLETE' },
                        Updated: { N: `${Date.now() / 1000 - 100}` }
                    }
                };
                return new Promise((resolve, reject) => {
                    resolve(mockItem);
                });
            };
            const fakeFun = function(_params) { return Promise.resolve({ data: null }); };
            const getItemStub = sinon.stub().callsFake(fakeGetFun);
            const putItemStub = sinon.stub().callsFake(fakeFun);
            const updateItemStub = sinon.stub().callsFake(fakeFun);

            mockDDB(getItemStub, putItemStub, updateItemStub);

            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: sinon.spy(),
                succeed: sinon.spy()
            };

            const testEvent = {
                Records: [
                    mockRecord
                ]
            };

            const creds = await TestCollector.load();
            var collector = new TestCollector(ctx, creds);
            await collector.handleEvent(testEvent).catch(() => null);

            assert.equal(getItemStub.called, true, 'should get new item');
            assert.equal(putItemStub.notCalled, true, 'should not put a new item in');
            assert.equal(updateItemStub.notCalled, true, 'should not update the item to complete');
        });
        it('updates the state if it is successful', async function() {
            const fakeFun = function(_params) { return Promise.resolve({ data: null }); };
            const updateItemStub = sinon.stub().callsFake(fakeFun);

            mockDDB(null, null, updateItemStub);

            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {
                    assert.fail(error);
                },
                succeed: function() {}
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

            const creds = await TestCollector.load();
            var collector = new TestCollector(ctx, creds);
            await collector.handleEvent(testEvent);

            const updateItemArgs = updateItemStub.args[0][0];
            assert.equal(updateItemStub.called, true, 'should update the item to complete');
            assert.equal(updateItemArgs.Key.MessageId.S, "5fea7756-0ea4-451a-a703-a558b933e274");
        });
    });
    describe('Poll Request Tests', function() {
        let updateItemStub;
        beforeEach(function() { 
            const fakeFun = function(_params) { return Promise.resolve({ data: null }); };
            updateItemStub = sinon.stub().callsFake(fakeFun);
            mockDDB(null, null, updateItemStub);
        });
        afterEach(function() {
            restoreDDB();
            if( CloudWatch.prototype.putMetricData && CloudWatch.prototype.putMetricData.restore) {
                pawsStub.restore(CloudWatch, 'putMetricData');}
            // Restore various stubs that might be created in tests
            if (TestCollector.prototype.pawsGetLogs && TestCollector.prototype.pawsGetLogs.restore) {
                TestCollector.prototype.pawsGetLogs.restore();
            }
        });
        
        it('poll request success, single state', async function() {
            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {
                    assert.fail(error);
                },
                succeed: function() {
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

            const creds = await TestCollector.load();
            var collector = new TestCollector(ctx, creds);
            await collector.handleEvent(testEvent);
        });

        it('poll request error, single state', async function() {
            const getRemainingTimeInMillis = sinon.spy(() => 5000);
            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {
                    assert.fail('Invocation should succeed.');
                },
                succeed: function() {
                },
                getRemainingTimeInMillis
            };

            const testEvent = {
                Records: [
                    {
                        "body": "{\n  \"priv_collector_state\": {\n    \"since\": \"123\",\n    \"until\": \"321\"\n  }\n}",
                        "eventSourceARN": "arn:aws:sqs:us-east-1:352283894008:test-queue",
                    }
                ]
            };

            const creds = await TestCollector.load();
            var collector = new TestCollector(ctx, creds);
            collector.mockGetLogsError = 'Error getting logs';
            await collector.handleEvent(testEvent);
            sinon.assert.calledOnce(updateItemStub);
        });

        it('does not enqueue new SQS state when remaining time is low', async function() {
            const getRemainingTimeInMillis = sinon.spy(() => 1000);
            const updateStateStub = sinon.stub(TestCollector.prototype, 'updateStateDBEntry').callsFake(() => Promise.resolve({ data: null }));
            const getLogsStub = sinon.stub(TestCollector.prototype, 'pawsGetLogs').callsFake(() => Promise.reject(new Error('third party API failed')));

            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function() {},
                succeed: function() {},
                getRemainingTimeInMillis
            };

            const testEvent = {
                Records: [
                    {
                        "body": "{\n  \"priv_collector_state\": {\n    \"since\": \"123\",\n    \"until\": \"321\"\n  }\n}",
                        "eventSourceARN": "arn:aws:sqs:us-east-1:352283894008:test-queue",
                    }
                ]
            };

            const creds = await TestCollector.load();
            const collector = new TestCollector(ctx, creds);
            const storeCollectionStateStub = sinon.stub(collector, '_storeCollectionState').resolves();

            try {
                await collector.handleEvent(testEvent).catch(() => null);
                assert.equal(storeCollectionStateStub.notCalled, true, 'should not enqueue a new state when lambda is near timeout');
                assert.equal(updateStateStub.called, true, 'should update state status before exiting');
                assert.equal(updateStateStub.args[0][1], 'FAILED', 'should mark DDB state as FAILED');
            } finally {
                storeCollectionStateStub.restore();
                getLogsStub.restore();
                updateStateStub.restore();
            }
        });

        it('enqueues exactly one retry state when third-party API call fails and time is sufficient', async function() {
            mockCloudWatch();
            const getRemainingTimeInMillis = sinon.spy(() => 20000);
            const getLogsStub = sinon.stub(TestCollector.prototype, 'pawsGetLogs').callsFake(() => Promise.reject(new Error('third party API failed')));

            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {
                    assert.fail('Invocation should succeed after requeue.');
                },
                succeed: function() {},
                getRemainingTimeInMillis
            };

            const testEvent = {
                Records: [
                    {
                        "body": "{\n  \"priv_collector_state\": {\n    \"since\": \"123\",\n    \"until\": \"321\"\n  }\n}",
                        "eventSourceARN": "arn:aws:sqs:us-east-1:352283894008:test-queue",
                    }
                ]
            };

            const creds = await TestCollector.load();
            const collector = new TestCollector(ctx, creds);
            const storeCollectionStateStub = sinon.stub(collector, '_storeCollectionState').resolves();

            try {
                await collector.handleEvent(testEvent);
                sinon.assert.calledOnce(storeCollectionStateStub);
            } finally {
                storeCollectionStateStub.restore();
                getLogsStub.restore();
                pawsStub.restore(CloudWatch, 'putMetricData');
            }
        });

        it('enqueues exactly one retry state when ingest fails and time is sufficient', async function() {
            mockCloudWatch();
            const getRemainingTimeInMillis = sinon.spy(() => 20000);
            const batchLogProcessStub = sinon.stub(TestCollector.prototype, 'batchLogProcess').callsFake(() => Promise.reject(new Error('ingest failed')));

            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {
                    assert.fail('Invocation should succeed after requeue.');
                },
                succeed: function() {},
                getRemainingTimeInMillis
            };

            const testEvent = {
                Records: [
                    {
                        "body": "{\n  \"priv_collector_state\": {\n    \"since\": \"123\",\n    \"until\": \"321\"\n  }\n}",
                        "eventSourceARN": "arn:aws:sqs:us-east-1:352283894008:test-queue",
                    }
                ]
            };

            const creds = await TestCollector.load();
            const collector = new TestCollector(ctx, creds);
            const storeCollectionStateStub = sinon.stub(collector, '_storeCollectionState').resolves();

            try {
                await collector.handleEvent(testEvent);
                sinon.assert.calledOnce(storeCollectionStateStub);
            } finally {
                storeCollectionStateStub.restore();
                batchLogProcessStub.restore();
                pawsStub.restore(CloudWatch, 'putMetricData');
            }
        });

        it('requeues progressed state when a post-ingest step fails', async function() {
            mockCloudWatch();
            const getRemainingTimeInMillis = sinon.spy(() => 20000);
            const updateStateStub = sinon.stub(TestCollector.prototype, 'updateStateDBEntry').callsFake(() => Promise.resolve({ data: null }));
            const getLogsStub = sinon.stub(TestCollector.prototype, 'pawsGetLogs').callsFake(() => {
                return Promise.resolve([['log1', 'log2'], { since: '2021-07-01T02:37:37.617Z', until: '2021-07-01T03:37:37.617Z' }, 900]);
            });

            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {
                    assert.fail('Invocation should succeed.');
                },
                succeed: function() {},
                getRemainingTimeInMillis
            };

            const testEvent = {
                Records: [
                    {
                        "body": "{\n  \"priv_collector_state\": {\n    \"since\": \"123\",\n    \"until\": \"321\"\n  }\n}",
                        "eventSourceARN": "arn:aws:sqs:us-east-1:352283894008:test-queue",
                    }
                ]
            };

            const creds = await TestCollector.load();
            const collector = new TestCollector(ctx, creds);
            const reportCollectionDelayStub = sinon.stub(collector, 'reportCollectionDelay').resolves();
            const storeCollectionStateStub = sinon.stub(collector, '_storeCollectionState');
            storeCollectionStateStub.onFirstCall().rejects(new Error('SQS store failed after ingest'));
            storeCollectionStateStub.onSecondCall().resolves();

            try {
                await collector.handleEvent(testEvent);
                assert.equal(storeCollectionStateStub.callCount >= 2, true, 'should store success-path state then requeue on failure');
                const retryStoreCallArgs = storeCollectionStateStub.args[1];
                assert.equal(retryStoreCallArgs[1].since, '2021-07-01T02:37:37.617Z', 'should retry using progressed state returned by pawsGetLogs');
                assert.equal(retryStoreCallArgs[0].retry_count, 1, 'should increment retry_count while re-queuing');
                assert.equal(updateStateStub.callCount, 1, 'should mark state as FAILED on post-ingest failure');
                assert.equal(updateStateStub.args[0][1], 'FAILED', 'should update DDB status to FAILED before re-queue');
            } finally {
                reportCollectionDelayStub.restore();
                storeCollectionStateStub.restore();
                getLogsStub.restore();
                updateStateStub.restore();
                pawsStub.restore(CloudWatch, 'putMetricData');
            }
        });

        it('poll request success, multiple state', async function() {

            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {
                    assert.fail(error);
                },
                succeed: function() {
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

            const creds = await TestCollectorMultiState.load();
            var collector = new TestCollectorMultiState(ctx, creds);
            await collector.handleEvent(testEvent);
        });

        it('sends multiple SQS batches when greater than len privCollectorStates is > 10', function(done) {

            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {
                    assert.fail(error);
                    done();
                },
                succeed: function() {
                    done();
                }
            };

            let privCollectorStates = gen_state_objects(72);

            let initialPawsState = {
                priv_collector_state: privCollectorStates
            };

            TestCollectorMultiState.load().then(function(creds) {
                let collector = new TestCollectorMultiState(ctx, creds);
                collector._storeCollectionState(initialPawsState, privCollectorStates, 0).then(() => {
                    assert.equal(sqsSendMessageBatchStub.callCount, 8);
                    done();
                });
            });
        });
        it('Process the logs in batch if logs size >10000', async function() {
            mockCloudWatch();

            let mockSendLogmsgs = sinon.stub(m_alCollector.IngestC.prototype, 'sendLogmsgs').callsFake(
                function fakeFn(data) {
                    return new Promise(function(resolve, reject) {
                        resolve(null);
                    });
                });

            let mockSendLmcstats = sinon.stub(m_alCollector.IngestC.prototype, 'sendLmcstats').callsFake(
                function fakeFn(data) {
                    return new Promise(function(resolve, reject) {
                        resolve(null);
                    });
                });

            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {
                    assert.fail(error);
                },
                succeed: function() {
                }
            };

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
            const creds = await TestMaxLogSizeCollector.load();
            try {
                var collector = new TestMaxLogSizeCollector(ctx, creds);
                await collector.handleEvent(testEvent);
                sinon.assert.calledThrice(mockSendLogmsgs);
                sinon.assert.calledThrice(mockSendLmcstats);
            } finally {
                mockSendLogmsgs.restore();
                mockSendLmcstats.restore();
                pawsStub.restore(CloudWatch, 'putMetricData');
            }
        });

        it('Check sendCollectorStatus method call only after Five failed attempt', async function() {
            mockCloudWatch();
            let mockSendCollectorStatus = sinon.stub(m_al_aws.AlAwsCollectorV2.prototype, 'sendCollectorStatus').callsFake(
                function fakeFn(stream, status) {
                    return Promise.resolve(null);
                });

            let mockPawsGetLogs = sinon.stub(TestCollector.prototype, "pawsGetLogs").callsFake(
                function fakeFn(state) {
                    return Promise.reject({ name: 'OktaApiError', status: 401, errorCode: 'E0000011', errorSummary: 'Invalid token provided' });
                });

            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function (error) { },
                succeed: function () { },
                getRemainingTimeInMillis: function() {
                    return moment().valueOf();
                }
            };

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
            const creds = await TestCollector.load();
            try {
                var collector = new TestCollector(ctx, creds);
                await collector.handleEvent(testEvent);
                sinon.assert.callCount(mockSendCollectorStatus, 1);
                sinon.assert.calledOnce(mockPawsGetLogs);
            } finally {
                if (mockPawsGetLogs && mockPawsGetLogs.restore) {
                    mockPawsGetLogs.restore();
                }
                if (mockSendCollectorStatus && mockSendCollectorStatus.restore) {
                    mockSendCollectorStatus.restore();
                }
                pawsStub.restore(CloudWatch, 'putMetricData');
                restoreDDB();
            }
        });

        it('Check sendCollectorStatus method not call if failed attempt less < 5', async function() {
            mockCloudWatch();
            let mockSendCollectorStatus = sinon.stub(m_al_aws.AlAwsCollectorV2.prototype, 'sendCollectorStatus').callsFake(
                function fakeFn(stream, status) {
                    return Promise.resolve(null);
                });

            let mockPawsGetLogs = sinon.stub(TestCollector.prototype, "pawsGetLogs").callsFake(
                function fakeFn(state) {
                    return Promise.reject({ name: 'OktaApiError', status: 401, errorCode: 'E0000011', errorSummary: 'Invalid token provided' });
                });

            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {},
                succeed: function() {},
                getRemainingTimeInMillis: function() {
                    return moment().valueOf();
                }
            };

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
            const creds = await TestCollector.load();
            try {
                var collector = new TestCollector(ctx, creds);
                await collector.handleEvent(testEvent);
                sinon.assert.callCount(mockSendCollectorStatus, 0);
                sinon.assert.calledOnce(mockPawsGetLogs);
            } finally {
                if (mockPawsGetLogs && mockPawsGetLogs.restore) {
                    mockPawsGetLogs.restore();
                }
                if (mockSendCollectorStatus && mockSendCollectorStatus.restore) {
                    mockSendCollectorStatus.restore();
                }
                pawsStub.restore(CloudWatch, 'putMetricData');
                restoreDDB();
            }
        });

        it('Check body encoding error is handle by uploading the file in s3 bucket and collector return new state', function() {
            mockCloudWatch();
            const ingestError = {
                errorCode: 'AWSC0018',
                message: "AWSC0018 failed at logmsgs : 401 - \"{\\\"error\\\":\\\"body encoding invalid\\\"}",
                httpErrorCode: 400
            };

            let processLog = sinon.stub(m_al_aws.AlAwsCollectorV2.prototype, 'processLog').callsFake(
                function fakeFn(messages, formatFun, hostmetaElems) {
                    return Promise.reject(ingestError);
                });

            let handleIngestEncodingInvalidErrorMock = sinon.stub(m_al_aws.AlAwsCommon, 'handleIngestEncodingInvalidError').callsFake(
                function fakeFn(error, params) {
                    return Promise.resolve(null);
                });


            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {
                    processLog.restore();
                    handleIngestEncodingInvalidErrorMock.restore();
                    pawsStub.restore(CloudWatch, 'putMetricData');
                    assert.fail(error);
                },
                succeed: function() {
                    sinon.assert.calledOnce(processLog);
                    pawsStub.restore(CloudWatch, 'putMetricData');
                }
            };

            TestCollector.load().then(async function(creds) {
                var collector = new TestCollector(ctx, creds);
                const nextState = { state: 'new-state' };
                try {
                    const result = await collector.batchLogProcess(['log1', 'log2'], nextState, 900);
                    sinon.assert.calledOnce(handleIngestEncodingInvalidErrorMock);
                    assert.equal(result.privCollectorState, nextState);
                    assert.equal(result.nextInvocationTimeout, 900);
                    processLog.restore();
                    handleIngestEncodingInvalidErrorMock.restore();
                } catch (err) {
                    processLog.restore();
                    handleIngestEncodingInvalidErrorMock.restore();
                    assert.fail(err);
                }
            });
        });

        it('Throw the other ingest error except body encoding invalid', function() {
            const ingestError = {
                errorCode: 'AWSC0018',
                message: "AWSC0018 failed at logmsgs :  404 - \"{\"error\":\"Customer Not Active in AIMS\"}",
                httpErrorCode: 404
            };
            let processLog = sinon.stub(m_al_aws.AlAwsCollectorV2.prototype, 'processLog').callsFake(
                function fakeFn(messages, formatFun, hostmetaElems) {
                    return Promise.reject(ingestError);
                });

            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {
                    processLog.restore();
                    assert.fail(error);
                },
                succeed: function() {
                    processLog.restore();
                    sinon.assert.calledOnce(processLog);
                }
            };


            TestCollector.load().then(async function(creds) {
                var collector = new TestCollector(ctx, creds);
                const nextState = { state: 'new-state' };
                try {
                    await collector.batchLogProcess(['log1', 'log2'], nextState, 900);
                    // throw new Error('Should have thrown');
                } catch (err) {
                    assert.equal(err.errorCode, 'AWSC0018');
                    assert.equal(err.httpErrorCode, 404);
                }
            });
        });
        it('reportApiThrottling', function() {
            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {
                    assert.fail(error);
                },
                succeed: function() {
                }
            };
            TestCollector.load().then(async function(creds) {
                var collector = new TestCollector(ctx, creds);
                await collector.reportApiThrottling();
                pawsStub.restore(CloudWatch, 'putMetricData');
            });
        });

        it('sets the secret param properly', (done) => {
            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {
                    assert.fail(error);
                    done();
                },
                succeed: function() {
                    done();
                }
            };

            pawsStub.restore(KMS, 'encrypt');

            pawsStub.mock(SSM, 'putParameter', (params) => Promise.resolve({ Version: 2, Tier: 'Standard' }));

            pawsStub.mock(KMS, 'encrypt', function(params) {
                const data = {
                    CiphertextBlob: Buffer.from(params.Plaintext, 'base64')
                };
                return Promise.resolve(data);
            });

            TestCollector.load().then(function(creds) {
                const collector = new TestCollector(ctx, creds);
                const secretValue = 'a-secret';
                collector.setPawsSecret(secretValue).then((res) => {
                    assert.equal(res.Version, 2);
                    assert.equal(res.Tier, 'Standard');
                    pawsStub.restore(SSM, 'putParameter');
                    done();
                });
            });
        });

        it('reportCollectionDelay', function() {
            mockCloudWatch();
            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {
                    assert.fail(error);
                },
                succeed: function() {
                }
            };
            TestCollector.load().then(function(creds) {
                var collector = new TestCollector(ctx, creds);
                collector.reportCollectionDelay('2020-01-26T12:08:31.316Z').then(() => {
                    pawsStub.restore(CloudWatch, 'putMetricData');
                });
            });
        });

        it('reportClientError', function() {

            mockCloudWatch();
            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {
                    assert.fail(error);
                },
                succeed: function() {
                }
            };

            let errorObj = { name: 'OktaApiError', status: 401, errorCode: 'E0000011', errorSummary: 'Invalid token provided' };

            TestCollector.load().then(async function(creds) {
                var collector = new TestCollector(ctx, creds);
                await collector.reportClientError(errorObj);
                pawsStub.restore(CloudWatch, 'putMetricData');
            });
        });
        it('reportErrorToIngestApi', function() {
            mockCloudWatch();
            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {
                    assert.fail(error);
                },
                succeed: function() {
                }
            };

            let errorObj = { name: 'StatusCodeError', statusCode: 401, errorCode: 'E0000011', message: '401 - undefined' };

            TestCollector.load().then(async function(creds) {
                var collector = new TestCollector(ctx, creds);
                await collector.reportErrorToIngestApi(errorObj);
                pawsStub.restore(CloudWatch, 'putMetricData');
            });
        });

        it('reportDuplicateLogCount', function() {
            mockCloudWatch();
            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {
                    assert.fail(error);
                },
                succeed: function() {
                }
            };

            TestCollector.load().then(async function(creds) {
                var collector = new TestCollector(ctx, creds);
                await collector.reportDuplicateLogCount(6);
                pawsStub.restore(CloudWatch, 'putMetricData');
            });
        });

        it('reportCollectorStatus', function() {
            mockCloudWatch();
            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {
                    assert.fail(error);
                },
                succeed: function() {
                }
            };
            TestCollector.load().then(async function(creds) {
                var collector = new TestCollector(ctx, creds);
                const status = 'ok';
                await collector.reportCollectorStatus(status).then(() => {
                    pawsStub.restore(CloudWatch, 'putMetricData');
                });
            });
        });
    });

    describe('Register Tests', function() {
        it('Register success', async function() {
            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {
                    assert.fail(error);
                },
                succeed: function() {
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
                    "VpcId": "vpc-id",
                    "LogGroup": "log-group-name"
                }
            };

            const creds = await PawsCollector.load();
            var collector = new TestCollector(ctx, creds);
            await collector.handleEvent(testEvent);
            assert.equal(responseStub.called, true, 'should send cfn response');
        });
    });
    describe('Format Log Tests', function(){
        it('Format success', function(done) {
            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {
                    assert.fail(error);
                },
                succeed: function() {
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
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {
                    assert.fail(error);
                },
                succeed: function() {
                }
            };
            PawsCollector.load().then((creds) => {
                var collector = new TestCollectorNoOverrides(ctx, creds);
                assert.throws(function() { collector.pawsFormatLog("test"); }, Error);
                done();
            });
        });
    });

    describe('Get Log Tests', function() {
        afterEach(function() {
            // Restore pawsGetLogs spy if it was created
            if (TestCollector.prototype.pawsGetLogs && TestCollector.prototype.pawsGetLogs.restore) {
                TestCollector.prototype.pawsGetLogs.restore();
            }
            restoreDDB();
        });

        it('Get Log success', async function() {
            mockDDB(null, null, null, null);
            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {
                    assert.fail(error);
                },
                succeed: function() {
                }
            };

            const callbackStub = sinon.spy(TestCollector.prototype, "pawsGetLogs");
            var aimsCreds = pawsMock.AIMS_TEST_CREDS;
            var pawsCreds = pawsMock.PAWS_TEST_CREDS;
            var collector = new TestCollector(ctx, { aimsCreds, pawsCreds });
            const mockState = { state: 'initial-state' };

            const [logs, newState, newTimeout] = await collector.pawsGetLogs(mockState);
            assert.ok(callbackStub.called);
            assert.equal(logs.length, 2);
            assert.deepEqual(newState, { state: 'new-state' });
            assert.equal(newTimeout, 900);
            callbackStub.restore();
        });

        it('Get Log throw', function() {
            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {
                    assert.fail(error);
                },
                succeed: function() {
                }
            };

            const state = { state: 'initial-state' };
            //const callbackStub = sinon.stub(TestCollector.prototype, "pawsGetLogs");
            PawsCollector.load().then((creds) => {
                var collector = new TestCollectorNoOverrides(ctx, creds);
                assert.throws(async function() { await collector.pawsGetLogs(state); }, Error);
            });
        });
    });
    describe('Init Collection Tests', function() {
        it('Init Collection State success', function() {
            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {
                    assert.fail(error);
                },
                succeed: function() {
                }
            };
            const testEvent = { "event": "create" };
            const callbackStub = sinon.spy(TestCollector.prototype, "pawsInitCollectionState");
            PawsCollector.load().then(async (creds) => {
                var collector = new TestCollector(ctx, creds);
                const { newState, newTimeout } = await collector.pawsInitCollectionState(testEvent);
                assert.ok(callbackStub.called);
                assert.deepEqual(newState, { state: 'initial-state' });
                assert.equal(newTimeout, 900);
                callbackStub.restore();
            });
        });
        it('Init Collection State throw', function() {
            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {
                    assert.fail(error);
                },
                succeed: function() {
                }
            };

            const testEvent = { "event": "create" };
            //const callbackStub = sinon.stub(TestCollector.prototype, "pawsInitCollectionState");
            PawsCollector.load().then((creds) => {
                var collector = new TestCollectorNoOverrides(ctx, creds);
                assert.throws(async function() { await collector.pawsInitCollectionState(testEvent); }, Error);
            });
        });
    });
    describe('Get Register Parameters Tests', function() {
        it('Get Register Parameters populated', function() {
            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {
                    assert.fail(error);
                },
                succeed: function() {
                }
            };

            const testEvent = { "event": "create" };
            PawsCollector.load().then(async (creds) => {
                var collector = new TestCollector(ctx, creds);
                const objectWithRegistrationProperties = await collector.pawsGetRegisterParameters(testEvent);
                assert.deepEqual(objectWithRegistrationProperties, { register: 'test-param' });
            });
        });
        it('Get Register Parameters empty', function() {
            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {
                    assert.fail(error);
                },
                succeed: function() {
                }
            };

            const testEvent = { "event": "create" };
            PawsCollector.load().then((creds) => {
                var collector = new TestCollectorNoOverrides(ctx, creds);
                const objectWithRegistrationProperties = collector.pawsGetRegisterParameters(testEvent);
                assert.deepEqual(objectWithRegistrationProperties, {});
            });
        });
    });

    describe('removeDuplicatedItem', function() {
        afterEach(function() {
            restoreDDB();
        });
        it('Added the data if item not exist', function(done) {
            const fakeFun = function(_params) { return Promise.resolve({ data: null }); };
            const putItemStub = sinon.stub().callsFake(fakeFun);
            mockDDB(null, putItemStub, null);

            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {
                    assert.fail(error);
                    done();
                },
                succeed: function() {
                    const putItemArgs = putItemStub.args[0][0];
                    assert.equal(putItemArgs.called, true, 'should added the item');
                    assert.equal(putItemArgs.Key.Id.S, "c5d8e7ea-90b0-4549-9746-f67c8f6c00");
                    done();
                }
            };

            PawsCollector.load().then(async (creds) => {
                var collector = new TestCollectorNoOverrides(ctx, creds);
                try {
                    const uniqueLogs = await collector.removeDuplicatedItem(pawsMock.MOCK_LOGS, 'Id');
                    assert.deepEqual(uniqueLogs.length, pawsMock.MOCK_LOGS.length);
                    done();
                } catch (error) {
                    assert.fail(error);
                    done();
                }
            });
        });

        it('Discard record if it is duplicate', function() {
            const ddbError = {
                "message": "The conditional request failed",
                "name": "ConditionalCheckFailedException",
                "time": "2021-09-01T12:34:56.789Z",
                "requestId": "12345678-1234-1234-1234-123456789012",
                "statusCode": 400,
                "retryable": false
            };
            const putItemStub = sinon.stub().callsFake(
                function(_params) {
                    return Promise.reject(ddbError);
                });

            mockDDB(null, putItemStub, null);

            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {
                    assert.fail(error);
                },
                succeed: function() {
                    const putItemArgs = putItemStub.args[0][0];
                    assert.equal(putItemArgs.called, true, 'should added the item');
                    assert.equal(putItemArgs.Key.Id.S, "c5d8e7ea-90b0-4549-9746-f67c8f6c00");
                }
            };
            pawsStub.mock(CloudWatch, 'putMetricData', (params) => Promise.resolve(null));
            PawsCollector.load().then(async (creds) => {
                var collector = new TestCollectorNoOverrides(ctx, creds);
                try {
                    const uniqueLogs = await collector.removeDuplicatedItem(pawsMock.MOCK_LOGS, 'Id');
                    assert.equal(uniqueLogs.length, 0);
                    pawsStub.restore(CloudWatch, 'putMetricData');
                } catch (error) {
                    pawsStub.restore(CloudWatch, 'putMetricData');
                    assert.fail(error);
                }
            });
        });

        it('Added only not existing item and discard duplicate item', function(done) {
            let ddbError = {
                "message": "The conditional request failed",
                "name": "ConditionalCheckFailedException",
                "time": "2021-09-01T12:34:56.789Z",
                "requestId": "12345678-1234-1234-1234-123456789012",
                "statusCode": 400,
                "retryable": false
            };
            const fakeFunError = function(_params) {
                return Promise.reject(ddbError);
            };
            const fakeFunSuccess = function(_params) {
                return Promise.resolve({ data: null });
            };
            let putItemStub = sinon.stub().onFirstCall().callsFake(fakeFunError)
                .onSecondCall().callsFake(fakeFunSuccess);

            mockDDB(null, putItemStub, null);
            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {
                    assert.fail(error);
                    done();
                },
                succeed: function() {
                    const putItemArgs = putItemStub.args[0][0];
                    assert.equal(putItemArgs.called, true, 'should added the item');
                    assert.equal(putItemArgs.Key.Id.S, "c5d8e7ea-90b0-4549-9746-f67c8f6c00");
                    done();
                }
            };
            pawsStub.mock(CloudWatch, 'putMetricData', (params) => Promise.resolve(null));
            PawsCollector.load().then(async (creds) => {
                var collector = new TestCollectorNoOverrides(ctx, creds);
                try {
                    const uniqueLogs = await collector.removeDuplicatedItem(pawsMock.MOCK_LOGS, 'Id');
                    assert.equal(uniqueLogs.length, 1);
                    pawsStub.restore(CloudWatch, 'putMetricData');
                    done();
                } catch (error) {
                    pawsStub.restore(CloudWatch, 'putMetricData');
                    assert.fail(error);
                    done();
                }
            });
        });

        it('Check if ddb send error except ConditionalCheckFailedException ', function(done) {
            let ddbError = {
                "message": "The level of configured provisioned throughput for the table was exceeded. Consider increasing your provisioning level with the UpdateTable API.",
                "name": "ProvisionedThroughputExceededException",
                "time": "2021-09-01T12:34:56.789Z",
                "requestId": "12345678-1234-1234-1234-123456789012",
                "statusCode": 400,
                "retryable": true
            };
            const fakeFunError = function(_params) {
                return Promise.reject(ddbError);
            };
            const fakeFunSuccess = function(_params) {
                return Promise.resolve({ data: null });
            };
            let putItemStub = sinon.stub().onFirstCall().callsFake(fakeFunError)
                .onSecondCall().callsFake(fakeFunSuccess);

            mockDDB(null, putItemStub, null);
            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {
                    assert.fail(error);
                    done();
                },
                succeed: function() {
                    const putItemArgs = putItemStub.args[0][0];
                    assert.equal(putItemArgs.called, true, 'should added the item');
                    assert.equal(putItemArgs.Key.Id.S, "c5d8e7ea-90b0-4549-9746-f67c8f6c00");
                    done();
                }
            };
            pawsStub.mock(CloudWatch, 'putMetricData', (params) => Promise.resolve(null));
            PawsCollector.load().then(async (creds) => {
                var collector = new TestCollectorNoOverrides(ctx, creds);
                try {
                    await collector.removeDuplicatedItem(pawsMock.MOCK_LOGS, 'Id');
                    pawsStub.restore(CloudWatch, 'putMetricData');
                    assert.fail('Should have thrown an error');
                    done();
                } catch (error) {
                    assert.notEqual(error, null);
                    pawsStub.restore(CloudWatch, 'putMetricData');
                    done();
                }
            });
        });
    });

    describe('handle the ingest error for deduplogs for o365 collector', function() {
        afterEach(function() {
            restoreDDB();
            if (m_al_aws.AlAwsCollectorV2.prototype.processLog.restore) {
                pawsStub.restore(CloudWatch, 'putMetricData');
            }

            if (m_al_aws.AlAwsCollectorV2.prototype.processLog.restore) {
                m_al_aws.AlAwsCollectorV2.prototype.processLog.restore();
            }
        });
        it('delete the item in batches', function(done) {
            const fakeFun = function(_params) {
                return new Promise((resolve, reject) => {
                    resolve(null);
                });
            };
            const batchWriteItemStub = sinon.stub().callsFake(fakeFun);

            mockDDB(null, null, null, batchWriteItemStub);

            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {
                    assert.fail(error);
                    done();
                },
                succeed: function() {
                    done();
                }
            };

            PawsCollector.load().then(async (creds) => {
                var collector = new TestCollectorNoOverrides(ctx, creds);
                await collector.deleteDedupLogItemEntry(pawsMock.MOCK_LOGS);
                sinon.assert.calledOnce(batchWriteItemStub);
                done();
            });
        });

        it('if data is more the ddb batch size and batch size byte, it should split into different batchs', function(done) {
            const fakeFun = function(_params) {
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
                fail: function(error) {
                    assert.fail(error);
                    done();
                },
                succeed: function() {
                    done();
                }
            };

            PawsCollector.load().then(async (creds) => {
                var collector = new TestCollectorNoOverrides(ctx, creds);
                await collector.deleteDedupLogItemEntry(logs);
                sinon.assert.calledTwice(batchWriteItemStub);
                done();
            });
        });

        it('it should return the error if fail to processed the item ', function() {
            let ddbError = {
                "message": "The level of configured provisioned throughput for the table was exceeded. Consider increasing your provisioning level with the UpdateTable API.",
                "name": "ProvisionedThroughputExceededException",
                "time": "2021-09-01T12:34:56.789Z",
                "requestId": "12345678-1234-1234-1234-123456789012",
                "statusCode": 400,
                "retryable": true
            };
            const fakeFunError = function(_params) {
                return new Promise((resolve, reject) => {
                    reject(ddbError);
                });
            };
            const fakeFunSuccess = function(_params) {
                return new Promise((resolve, reject) => {
                    resolve(null);
                });
            };
            let batchWriteItemStub = sinon.stub().onFirstCall().callsFake(fakeFunError)
                .onSecondCall().callsFake(fakeFunSuccess);

            mockDDB(null, null, null, batchWriteItemStub);

            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {
                    assert.fail(error);
                },
                succeed: function() {
                    const batchWriteItemArgs = batchWriteItemStub.args[0][0];
                    assert.equal(batchWriteItemArgs.called, true, 'should delete the item');
                }
            };

            PawsCollector.load().then(async (creds) => {
                var collector = new TestCollectorNoOverrides(ctx, creds);
                await collector.deleteDedupLogItemEntry(pawsMock.MOCK_LOGS);
                sinon.assert.calledOnce(batchWriteItemStub);
            });
        });

        it('Check if ingest error occure for collector type o365, it should delete the item entry for failed message from ddb', function(done) {
            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {
                    assert.fail(error);
                    done();
                },
                succeed: function() {
                    done();
                }
            };

            process.env.paws_type_name = 'o365';
            const ingestError = {
                errorCode: 'AWSC0018',
                message: "AWSC0018 failed at logmsgs : 307 - \"{\\\"error\\\":\\\"temporary redirect\\\"}",
                httpErrorCode: 307
            };
            const fakeFunError = function(messages, formatFun, hostmetaElems) {
                return Promise.reject(ingestError);
            };
            const fakeFunSuccess = function(messages, formatFun, hostmetaElems) {
                return Promise.resolve({ data: null });
            };

            let processLog = sinon.stub(m_al_aws.AlAwsCollectorV2.prototype, 'processLog').onFirstCall().callsFake(fakeFunSuccess)
                .onSecondCall().callsFake(fakeFunSuccess).onThirdCall().callsFake(fakeFunError);

            mockCloudWatch();

            const fakeFun = function(_params) {
                return new Promise((resolve, reject) => {
                    resolve(null);
                });
            };
            const batchWriteItemStub = sinon.stub().callsFake(fakeFun);

            mockDDB(null, null, null, batchWriteItemStub);

            TestCollector.load().then(async function(creds) {
                var collector = new TestCollector(ctx, creds);
                const nextState = { state: 'new-state' };
                const logs = [];
                for (let i = 0; i < 20100; i++) {
                    logs.push('log' + Math.random());
                }
                try {
                    await collector.batchLogProcess(logs, nextState, 900);
                    done(new Error('Should have thrown'));
                } catch (err) {
                    sinon.assert.calledThrice(processLog);
                    sinon.assert.callCount(batchWriteItemStub, 4);
                    assert.equal(ingestError, err);
                    pawsStub.restore(CloudWatch, 'putMetricData');
                    processLog.restore();
                    done();
                }
            });
        });

        it('If collector type other than o365 then it shoud return the same error', function() {
            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {
                    assert.fail(error);
                },
                succeed: function() {
                }
            };

            process.env.paws_type_name = 'okta';
            const ingestError = {
                errorCode: 'AWSC0018',
                message: "AWSC0018 failed at logmsgs : 307 - \"{\\\"error\\\":\\\"temporary redirect\\\"}",
                httpErrorCode: 307
            };

            const fakeFunError = function(messages, formatFun, hostmetaElems) {
                return Promise.reject(ingestError);
            };
            const fakeFunSuccess = function(messages, formatFun, hostmetaElems) {
                return Promise.resolve({ data: null });
            };

            let processLog = sinon.stub(m_al_aws.AlAwsCollectorV2.prototype, 'processLog').onFirstCall().callsFake(fakeFunSuccess)
                .onSecondCall().callsFake(fakeFunSuccess).onThirdCall().callsFake(fakeFunError);

            mockCloudWatch();

            const fakeFun = function(_params) {
                return new Promise((resolve, reject) => {
                    resolve(null);
                });
            };
            const batchWriteItemStub = sinon.stub().callsFake(fakeFun);

            mockDDB(null, null, null, batchWriteItemStub);

            TestCollector.load().then(async function(creds) {
                var collector = new TestCollector(ctx, creds);
                const nextState = { state: 'new-state' };
                const logs = [];
                for (let i = 0; i < 20050; i++) {
                    logs.push('log' + Math.random());
                }
                try {
                    await collector.batchLogProcess(logs, nextState, 900);
                    throw new Error('Should have thrown');
                } catch (err) {
                    sinon.assert.calledThrice(processLog);
                    sinon.assert.callCount(batchWriteItemStub, 0);
                    assert.equal(ingestError, err);
                    pawsStub.restore(CloudWatch, 'putMetricData');
                    processLog.restore();
                }
            });
        });

        it('Check if "Maximum payload size exceeded" error return from al-collector.js then it should reduce the batch size and make ingest api call again', function() {
            mockDDB();
            let ctx = {
                invokedFunctionArn: pawsMock.FUNCTION_ARN,
                fail: function(error) {
                    assert.fail(error);
                },
                succeed: function() {
                }
            };
            const maxPayloadError = "Maximum payload size exceeded: 2812";

            const fakeFunError = function(messages, formatFun, hostmetaElems) {
                return Promise.reject(maxPayloadError);
            };
            const fakeFunSuccess = function(messages, formatFun, hostmetaElems) {
                return Promise.resolve({ data: null });
            };
            let processLog = sinon.stub(m_al_aws.AlAwsCollectorV2.prototype, 'processLog').onFirstCall().callsFake(
                fakeFunError).onSecondCall().callsFake(fakeFunSuccess).onThirdCall().callsFake(fakeFunSuccess);

            TestCollector.load().then(async function(creds) {
                var collector = new TestCollector(ctx, creds);
                const nextState = { state: 'new-state' };
                try {
                    const result = await collector.batchLogProcess(['log1', 'log2', 'log3'], nextState, 900);
                    assert.equal(result.privCollectorState, nextState);
                    assert.equal(result.nextInvocationTimeout, 900);
                    sinon.assert.callCount(processLog, 3);
                    processLog.restore();
                } catch (err) {
                    throw err;
                }
            });
        });
    });
});
