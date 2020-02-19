const assert = require('assert');
const sinon = require('sinon');
var AWS = require('aws-sdk-mock');
const m_response = require('cfn-response');
const salesforceMock = require('./salesforce_mock');
var SalesforceCollector = require('../collector').SalesforceCollector;


var responseStub = {};
describe('Unit Tests', function() {

    beforeEach(function () {
        AWS.mock('SSM', 'getParameter', function (params, callback) {
            const data = new Buffer('test-secret');
            return callback(null, { Parameter: { Value: data.toString('base64') } });
        });
        AWS.mock('KMS', 'decrypt', function (params, callback) {
            const data = {
                Plaintext: '{}'
            };
            return callback(null, data);
        });

        responseStub = sinon.stub(m_response, 'send').callsFake(
            function fakeFn(event, mockContext, responseStatus, responseData, physicalResourceId) {
                mockContext.succeed();
            });
    });

    afterEach(function () {
        responseStub.restore();
    });


    describe('Next state tests', function() {
        it('log format success', function(done) {
            let ctx = {
                invokedFunctionArn : salesforceMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            
            SalesforceCollector.load().then(function(creds) {
                var collector = new SalesforceCollector(ctx, creds, 'salesforce');
                let nextState = collector._getNextCollectionState(salesforceMock.LOG_EVENT);
                assert.equal(nextState.poll_interval_sec, 60);
                done();
            });
        });
    });

    describe('Format Tests', function() {
        it('log format success', function(done) {
            let ctx = {
                invokedFunctionArn : salesforceMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            
            SalesforceCollector.load().then(function(creds) {
                var collector = new SalesforceCollector(ctx, creds, 'salesforce');
                let fmt = collector.pawsFormatLog(salesforceMock.LOG_EVENT);
                assert.equal(fmt.progName, 'SalesforceCollector');
                assert.ok(fmt.messageType);
                done();
            });
        });
    });
});
