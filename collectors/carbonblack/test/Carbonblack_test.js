const assert = require('assert');
const sinon = require('sinon');
var AWS = require('aws-sdk-mock');
const m_response = require('cfn-response');
const carbonblackMock = require('./carbonblack_mock');
var CarbonblackCollector = require('../collector').CarbonblackCollector;
const moment = require('moment');
const utils = require("../utils");


var responseStub = {};
let getAPIDetails;
let getAPILogs;

function setAlServiceStub() {
    getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(
        function fakeFn(apiDetails, accumulator, state, clientSecret, clientId, maxPagesPerInvocation) {
            return new Promise(function (resolve, reject) {
                return resolve({ accumulator: [carbonblackMock.LOG_EVENT, carbonblackMock.LOG_EVENT]});
            });
        });

    getAPIDetails = sinon.stub(utils, 'getAPIDetails').callsFake(
        function fakeFn(state, apiEndpoint, orgKey) {
            return {
                url: "url",
                method: "GET",
                requestBody: "sortFieldName",
                typeIdPaths: [{ path: ["eventId"] }],
                tsPaths: [{ path: ["eventTime"] }]
            };
        });

}

function restoreAlServiceStub() {
    getAPILogs.restore();
    getAPIDetails.restore();
}

describe('Unit Tests', function () {

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
        restoreAlServiceStub();
        responseStub.restore();
    });

    describe('Paws Init Collection State', function () {
        let ctx = {
            invokedFunctionArn: carbonblackMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('Paws Init Collection State Success', function (done) {
            setAlServiceStub();
            CarbonblackCollector.load().then(function (creds) {
                var collector = new CarbonblackCollector(ctx, creds, 'carbonblack');
                const startDate = moment().subtract(1, 'days').toISOString();
                process.env.paws_collection_start_ts = startDate;

                collector.pawsInitCollectionState(null, (err, initialStates, nextPoll) => {
                    initialStates.forEach((state) => {
                        assert.equal(moment(state.until).diff(state.since, 'seconds'), 60);
                    });
                    done();
                });
            });
        });
    });

    describe('Paws Get Register Parameters', function () {
        it('Paws Get Register Parameters Success', function (done) {
            setAlServiceStub();
            let ctx = {
                invokedFunctionArn: carbonblackMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };

            CarbonblackCollector.load().then(function (creds) {
                var collector = new CarbonblackCollector(ctx, creds, 'carbonblack');
                const sampleEvent = { ResourceProperties: { StackName: 'a-stack-name' } };
                collector.pawsGetRegisterParameters(sampleEvent, (err, regValues) => {
                    const expectedRegValues = {
                        carbonblackAPINames: '["AuditLogEvents", "SearchAlerts","SearchAlertsCBAnalytics", "SearchAlertsVmware", "SearchAlertsWatchlist"]',
                        carbonblackOrgKey: 'carbonblackOrgKey'
                    };
                    assert.deepEqual(regValues, expectedRegValues);
                    done();
                });
            });
        });
    });

    describe('pawsGetLogs', function () {
        let ctx = {
            invokedFunctionArn: carbonblackMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('Paws Get Logs Success', function (done) {
            setAlServiceStub();
            CarbonblackCollector.load().then(function (creds) {
                var collector = new CarbonblackCollector(ctx, creds, 'carbonblack');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    stream: "AuditLogEvents",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    nextPage: null,
                    poll_interval_sec: 1
                };

                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(logs.length, 2);
                    assert.equal(newState.poll_interval_sec, 1);
                    assert.ok(logs[0].eventId);
                    done();
                });

            });
        });
    });

    describe('Next state test', function () {
        it('Next state test success', function(done) {
            setAlServiceStub();
            let ctx = {
                invokedFunctionArn : carbonblackMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            
            CarbonblackCollector.load().then(function(creds) {
                var collector = new CarbonblackCollector(ctx, creds, 'carbonblack');
                const startDate = moment();
                const curState = {
                    since: startDate.toISOString(),
                    until: startDate.add(collector.pollInterval, 'seconds').toISOString(),
                    poll_interval_sec: 1
                };
                let nextState = collector._getNextCollectionState(curState);
                assert.equal(moment(nextState.until).diff(nextState.since, 'seconds'), collector.pollInterval);
                assert.equal(nextState.poll_interval_sec, collector.pollInterval);
                done();
            });
        });

    });

    describe('Format Tests', function () {
        it('log format success', function (done) {
            setAlServiceStub();
            let ctx = {
                invokedFunctionArn: carbonblackMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };

            CarbonblackCollector.load().then(function (creds) {
                var collector = new CarbonblackCollector(ctx, creds, 'carbonblack');
                let fmt = collector.pawsFormatLog(carbonblackMock.LOG_EVENT);
                assert.equal(fmt.progName, 'CarbonblackCollector');
                assert.ok(fmt.messageType);
                done();
            });
        });
    });

    describe('NextCollectionStateWithNextPage', function () {
        it('Get Next Collection State With NextPage Success', function (done) {
            setAlServiceStub();
            let ctx = {
                invokedFunctionArn: carbonblackMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };

            const startDate = moment().subtract(5, 'minutes');
            const curState = {
                stream: "SearchAlerts",
                since: startDate.toISOString(),
                until: startDate.add(5, 'minutes').toISOString(),
                poll_interval_sec: 1
            };
            const nextPage = "offset";
            CarbonblackCollector.load().then(function (creds) {
                var collector = new CarbonblackCollector(ctx, creds, 'carbonblack');
                let nextState = collector._getNextCollectionStateWithNextPage(curState, nextPage);
                assert.ok(nextState.nextPage);
                assert.equal(nextState.nextPage, nextPage);
                done();
            });
        });
    });

    describe('pawsGetLogs', function () {
        let errorObj = {
            statusCode: 401, error: {
                notifications: null,
                success: false,
                message: 'Authentication failure'
            }
        };
        beforeEach(function () {
            getAPIDetails = sinon.stub(utils, 'getAPIDetails').callsFake(
                function fakeFn(state, apiEndpoint, orgKey) {
                    return {
                        url: "url",
                        method: "GET",
                        requestBody: "sortFieldName",
                        typeIdPaths: [{ path: ["eventId"] }],
                        tsPaths: [{ path: ["eventTime"] }]
                    };
                });
            getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(
                function fakeFn(apiDetails, accumulator, state, clientSecret, clientId, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return reject(errorObj);
                    });
                });
        });
        let ctx = {
            invokedFunctionArn: carbonblackMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('Paws Get Logs Fail', function (done) {

            CarbonblackCollector.load().then(function (creds) {
                var collector = new CarbonblackCollector(ctx, creds, 'carbonblack');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    stream: "AuditLogEvents",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    nextPage: null,
                    poll_interval_sec: 1
                };
                
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(err.errorCode, errorObj.statusCode);
                    assert.equal(err.error.message, errorObj.error.message);
                    done();
                });
            });
        });
    });
});
