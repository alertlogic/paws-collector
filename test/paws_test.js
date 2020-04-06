const assert = require('assert');
const sinon = require('sinon');
var AWS = require('aws-sdk-mock');
const m_response = require('cfn-response');

const pawsMock = require('./paws_mock');
var m_alCollector = require('@alertlogic/al-collector-js');
var PawsCollector = require('../paws_collector').PawsCollector;
const m_al_aws = require('@alertlogic/al-aws-collector-js').Util;


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
    setEnvStub = sinon.stub(m_al_aws, 'setEnv').callsFake((vars, callback)=>{
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

function gen_state_objects(num) {
    return new Array(num).fill(0).map((e,i) => ({state: 'new-state-' + i}));
}

class TestCollector extends PawsCollector {
    constructor(ctx, creds) {
        super(ctx, creds);
    }
    
    pawsInitCollectionState(event, callback) {
        return callback(null, {state: 'initial-state'}, 900);
    }   
    
    pawsGetLogs(state, callback) {
        return callback(null, ['log1', 'log2'], {state: 'new-state'}, 900);
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
            const data = new Buffer('test-secret');
            return callback(null, {Parameter : { Value: data.toString('base64')}});
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
        restoreAlServiceStub();
        setEnvStub.restore();
        responseStub.restore();
        AWS.restore('KMS');
        AWS.restore('SSM');
    });
    
    describe('Poll Request Tests', function() {
        it('poll request success, single state', function(done) {
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
        
        it('poll request success, multiple state', function(done) {
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
            let putMetricDataSpy = sinon.spy((params, callback) => callback());
            AWS.mock('CloudWatch', 'putMetricData', putMetricDataSpy);
            TestCollector.load().then(function(creds) {
                var collector = new TestCollector(ctx, creds);
                collector.reportApiThrottling(function(error) {
                    assert.equal(null, error);
                    assert.equal(putMetricDataSpy.callCount, 1);
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

            let putParameterSpy = sinon.spy((params, callback) => callback(null, {Version: 2, Tier:'Standard'}));
            AWS.mock('SSM', 'putParameter', putParameterSpy);

            AWS.mock('KMS', 'encrypt', function (params, callback) {
                const data = {
                    CiphertextBlob : params.Plaintext
                };
                return callback(null, data);
            });

            TestCollector.load().then(function(creds) {
                const collector = new TestCollector(ctx, creds);
                const secretValue = 'a-secret';
                const base64 = new Buffer(secretValue).toString('base64');
                collector.setPawsSecret(secretValue).then(() => {
                    assert.equal(putParameterSpy.getCall(0).args[0].Value, base64);
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
            let putMetricDataSpy = sinon.spy((params, callback) => callback());
            AWS.mock('CloudWatch', 'putMetricData', putMetricDataSpy);
            TestCollector.load().then(function(creds) {
                var collector = new TestCollector(ctx, creds);
                collector.reportCollectionDelay('2020-01-26T12:08:31.316Z', function(error) {
                    assert.equal(null, error);
                    assert.equal(putMetricDataSpy.callCount, 1);
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

