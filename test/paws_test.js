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
        let formattedMsg = {
            messageTs: 12345678,
            priority: 11,
            progName: 'OktaCollector',
            message: JSON.stringify({test: 'message'}),
            messageType: 'json/aws.test'
        };
        return formattedMsg;
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
        return callback(null, ['log1', 'log2'], [{state: 'new-state-1'}, {state: 'new-state-2'}], 900);
    }
    
    pawsGetRegisterParameters(event, callback) {
        return callback(null, {register: 'test-param'});
    }
    
    pawsFormatLog(msg) {
        let formattedMsg = {
            messageTs: 12345678,
            priority: 11,
            progName: 'OktaCollectorArrayState',
            message: JSON.stringify({test: 'message'}),
            messageType: 'json/aws.test'
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
});
