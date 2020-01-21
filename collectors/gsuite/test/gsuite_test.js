const assert = require('assert');
const sinon = require('sinon');
var AWS = require('aws-sdk-mock');
const m_response = require('cfn-response');
const moment = require('moment');

const gsuiteMock = require('./gsuite_mock');
//var m_alCollector = require('@alertlogic/al-collector-js');
var GsuiteCollector = require('../collector').GsuiteCollector;
//const m_al_aws = require('@alertlogic/al-aws-collector-js').Util;
const utils = require("../utils");
const { auth } = require("google-auth-library");


var responseStub = {};
let listEvent;
let authenticationT;
const _0=0;

function setAlServiceStub() {
    authenticationT  = sinon.stub(auth, 'fromJSON').callsFake(
        function fakeFn(path) {
            return {};
        });
    listEvent = sinon.stub(utils, 'listEvents').callsFake(
        function fakeFn(path) {
            return new Promise(function(resolve, reject) {
                return resolve([gsuiteMock.LOG_EVENT]);
            });
        });

}

function restoreAlServiceStub() {
    listEvent.restore();
    authenticationT.restore();
}
describe('Unit Tests', function() {

    beforeEach(function(){
        AWS.mock('KMS', 'decrypt', function (params, callback) {
            const data = {
                    Plaintext : '{}'
            };
            return callback(null, data);
        });

        responseStub = sinon.stub(m_response, 'send').callsFake(
            function fakeFn(event, mockContext, responseStatus, responseData, physicalResourceId) {
                mockContext.succeed();
            });

        setAlServiceStub();
    });

    afterEach(function(){
        restoreAlServiceStub();   
        responseStub.restore();
    });

    describe('Paws Init Collection State', function() {
        it('Paws Init Collection State Success', function(done) {
            let ctx = {
                invokedFunctionArn : gsuiteMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            
            GsuiteCollector.load().then(function(creds) {
                var collector = new GsuiteCollector(ctx, creds, 'gsuite');
                const startDate = moment().subtract(1, 'days').toISOString();
                process.env.paws_collection_start_ts = startDate;
                collector.pawsInitCollectionState(null,(err, initialState, nextPoll) => {
                    assert.equal(initialState.since, startDate, "Dates are not equal");
                    assert.notEqual(moment(initialState.until).diff(initialState.since, 'hours'), 24);
                    done();
                });
            });
        });
    });

    describe('Paws Get Register Parameters', function() {
        it('Paws Get Register Parameters Success', function(done) {
            let ctx = {
                invokedFunctionArn : gsuiteMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            
            GsuiteCollector.load().then(function(creds) {
                var collector = new GsuiteCollector(ctx, creds, 'gsuite');
                const sampleEvent = {ResourceProperties: {StackName: 'a-stack-name'}};

               collector.pawsGetRegisterParameters(sampleEvent, (err, regValues) =>{
                    const expectedRegValues = {
                    };
                    assert.deepEqual(regValues, expectedRegValues);
                    done();
                }); 
            });
        });
    });

    describe('pawsGetLogs', function() {
        it('Paws Get Logs Success', function(done) {
            let ctx = {
                invokedFunctionArn : gsuiteMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            GsuiteCollector.load().then(function(creds) {
                var collector = new GsuiteCollector(ctx, creds, 'gsuite');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    poll_interval_sec: 1
                };

                process.env.paws_email_id = 'test';
                process.env.paws_scopes = 'test';
                process.env.paws_application_names = 'test1,test2';  
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) =>{
                    assert.equal(logs.length, 2);
                    assert.ok(logs[_0].kind);
                    done();
                });
                
            });
        });
    });
 

    describe('Format Tests', function() {
        it('Log Format Tests Success', function(done) {
            let ctx = {
                invokedFunctionArn : gsuiteMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            
            GsuiteCollector.load().then(function(creds) {
                var collector = new GsuiteCollector(ctx, creds, 'gsuite');
                let fmt = collector.pawsFormatLog(gsuiteMock.LOG_EVENT);
                assert.equal(fmt.progName, 'GsuiteCollector');
                assert.ok(fmt.messageTypeId);
                done();
            });
        });
    });

    describe('Next State Tests', function() {
        it('Next State Tests Success', function(done) {
            let ctx = {
                invokedFunctionArn : gsuiteMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            const startDate = moment().subtract(5, 'minutes');
            const curState = {
                since: startDate.toISOString(),
                until: startDate.add(5, 'minutes').toISOString()
            };
            GsuiteCollector.load().then(function(creds) {
                var collector = new GsuiteCollector(ctx, creds, 'gsuite');
                let nextState = collector._getNextCollectionState(curState);
                assert.ok(nextState.since);
                done();
            });
        });
    });  
});
