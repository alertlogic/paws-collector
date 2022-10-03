const assert = require('assert');
const sinon = require('sinon');
var AWS = require('aws-sdk-mock');
const m_response = require('cfn-response');
const ciscoampMock = require('./ciscoamp_mock');
var CiscoampCollector = require('../collector').CiscoampCollector;
const moment = require('moment');
const utils = require("../utils");


var responseStub = {};
let getAPILogs, getAPIDetails;

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
        getAPILogs.restore();
        getAPIDetails.restore();
        responseStub.restore();
    });

    describe('Paws Init Collection State', function () {
        let ctx = {
            invokedFunctionArn: ciscoampMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('Paws Init Collection State Success', function (done) {
            getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(
                function fakeFn(baseUrl, authorization, apiUrl, accumulator, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return resolve({ accumulator: [ciscoampMock.LOG_EVENT, ciscoampMock.LOG_EVENT] });
                    });
                });
            getAPIDetails = sinon.stub(utils, 'getAPIDetails').callsFake(
                function fakeFn(state) {
                    return {
                        url: "api_url",
                        typeIdPaths: [{ path: ["audit_log_id"] }],
                        tsPaths: [{ path: ["created_at"] }]
                    };
                });
            CiscoampCollector.load().then(function (creds) {
                var collector = new CiscoampCollector(ctx, creds, 'ciscoamp');
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
            let ctx = {
                invokedFunctionArn: ciscoampMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };

            CiscoampCollector.load().then(function (creds) {
                var collector = new CiscoampCollector(ctx, creds, 'ciscoamp');
                const sampleEvent = { ResourceProperties: { StackName: 'a-stack-name' } };
                collector.pawsGetRegisterParameters(sampleEvent, (err, regValues) => {
                    const expectedRegValues = {
                        ciscoampResourceNames: '[\"AuditLogs\",\"Events\"]',
                    };
                    assert.deepEqual(regValues, expectedRegValues);
                    done();
                });
            });
        });
    });

    describe('pawsGetLogs', function () {
        let ctx = {
            invokedFunctionArn: ciscoampMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('Paws Get Logs Success', function (done) {
            getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(
                function fakeFn(baseUrl, authorization, apiUrl, accumulator, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return resolve({ accumulator: [ciscoampMock.LOG_EVENT, ciscoampMock.LOG_EVENT] });
                    });
                });
            getAPIDetails = sinon.stub(utils, 'getAPIDetails').callsFake(
                function fakeFn(state) {
                    return {
                        url: "api_url",
                        typeIdPaths: [{ path: ["audit_log_id"] }],
                        tsPaths: [{ path: ["created_at"] }]
                    };
                });
            CiscoampCollector.load().then(function (creds) {
                var collector = new CiscoampCollector(ctx, creds, 'ciscoamp');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    resource: "AuditLogs",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    nextPage: null,
                    apiQuotaResetDate: null,
                    totalLogsCount: 0,
                    poll_interval_sec: 1
                };
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(logs.length, 2);
                    assert.equal(newState.poll_interval_sec, 1);
                    assert.ok(logs[0].audit_log_id);
                    done();
                });

            });
        });
        it('Paws Get Logs with nextPage Success', function (done) {
            getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(
                function fakeFn(baseUrl, authorization, apiUrl, accumulator, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return resolve({ accumulator: [ciscoampMock.LOG_EVENT, ciscoampMock.LOG_EVENT], nextPage: "nextPageUrl", newSince: undefined });
                    });
                });
            getAPIDetails = sinon.stub(utils, 'getAPIDetails').callsFake(
                function fakeFn(state) {
                    return {
                        url: "api_url",
                        typeIdPaths: [{ path: ["audit_log_id"] }],
                        tsPaths: [{ path: ["created_at"] }]
                    };
                });
            CiscoampCollector.load().then(function (creds) {
                var collector = new CiscoampCollector(ctx, creds, 'ciscoamp');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    stream: "AuditLogs",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    nextPage: "nextPageUrl",
                    apiQuotaResetDate: null,
                    totalLogsCount: 0,
                    poll_interval_sec: 1
                };
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(logs.length, 2);
                    assert.equal(newState.poll_interval_sec, 1);
                    assert.equal(newState.apiQuotaResetDate, null);
                    assert.ok(logs[0].audit_log_id);
                    done();
                });

            });
        });
        it('Paws Get Logs Success with Events and nextPage value is null', function (done) {
            ciscoampMock.LOG_EVENT.date = moment();
            getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(
                function fakeFn(baseUrl, authorization, apiUrl, accumulator, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return resolve({ accumulator: [ciscoampMock.LOG_EVENT, ciscoampMock.LOG_EVENT], nextPage: undefined, newSince: ciscoampMock.LOG_EVENT.date });
                    });
                });
            getAPIDetails = sinon.stub(utils, 'getAPIDetails').callsFake(
                function fakeFn(state) {
                    return {
                        url: "api_url",
                        typeIdPaths: [{ path: ["id"] }],
                        tsPaths: [{ path: ["date"] }]
                    };
                });
            CiscoampCollector.load().then(function (creds) {
                var collector = new CiscoampCollector(ctx, creds, 'ciscoamp');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    stream: "Events",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    nextPage: null,
                    apiQuotaResetDate: null,
                    totalLogsCount: 0,
                    poll_interval_sec: 1
                };
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(logs.length, 2);
                    assert.equal(newState.poll_interval_sec, newPollInterval);
                    assert.equal(newState.nextPage, null);
                    // checked  if nextpage is null then set since value from received data
                    assert.equal(newState.since, moment(ciscoampMock.LOG_EVENT.date).toISOString());
                    done();
                });

            });
        });
        
        it('Paws Get Logs with throttle error and set apiQuotaResetDate', function (done) {
            let errorObj = {
                statusCode: 429,
                response: {
                    body: {
                        version: null,
                        data: {},
                        errors: [
                            {
                                error_code: 429,
                                description: "RateLimitExceed",
                                details: [
                                    "API hourly Limit Exceeded"
                                ]
                            }
                        ]
                    },
                    headers: {
                        "x-ratelimit-limit": "200",
                        "x-ratelimit-reset": "59"
                    }
                }
            };

            getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(
                function fakeFn(baseUrl, authorization, apiUrl, accumulator, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return reject(errorObj);
                    });
                });
            getAPIDetails = sinon.stub(utils, 'getAPIDetails').callsFake(
                function fakeFn(state) {
                    return {
                        url: "api_url",
                        typeIdPaths: [{ path: ["id"] }],
                        tsPaths: [{ path: ["date"] }]
                    };
                });
            CiscoampCollector.load().then(function (creds) {
                var collector = new CiscoampCollector(ctx, creds, 'ciscoamp');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    stream: "Events",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    nextPage: null,
                    apiQuotaResetDate: null,
                    totalLogsCount: 0,
                    poll_interval_sec: 1
                };
                var reportSpy = sinon.spy(collector, 'reportApiThrottling');
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(err, null);
                    assert.equal(true, reportSpy.calledOnce);
                    assert.equal(logs.length, 0);
                    assert.notEqual(newState.apiQuotaResetDate, null);
                    assert.equal(newState.poll_interval_sec, newPollInterval);
                    done();
                });
            });
        });
        it('Get client error', function (done) {
            let errorObj = {
                statusCode: 401,
                error: {
                    version: null,
                    data: {},
                    errors:
                        [{
                            error_code: 401,
                            description: 'Unauthorized',
                            details: ['Unknown API key or Client ID']
                        }]
                }
            };
            getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(
                function fakeFn(baseUrl, authorization, apiUrl, accumulator, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return reject(errorObj);
                    });
                });

            getAPIDetails = sinon.stub(utils, 'getAPIDetails').callsFake(
                function fakeFn(state) {
                    return {
                        url: "api_url",
                        typeIdPaths: [{ path: ["audit_log_id"] }],
                        tsPaths: [{ path: ["created_at"] }]
                    };
                });
            CiscoampCollector.load().then(function (creds) {
                var collector = new CiscoampCollector(ctx, creds, 'ciscoamp');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    resource: "AuditLogs",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    nextPage: null,
                    apiQuotaResetDate: null,
                    totalLogsCount: 0,
                    poll_interval_sec: 1
                };
               
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(err.errorCode, 401);
                    done();
                });
            });
        });
    });

    describe('Next state tests', function () {
        it('log format success', function (done) {
            let ctx = {
                invokedFunctionArn: ciscoampMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };

            CiscoampCollector.load().then(function (creds) {
                var collector = new CiscoampCollector(ctx, creds, 'ciscoamp');
                const startDate = moment();
                const curState = {
                    resource: "Events",
                    since: startDate.toISOString(),
                    until: startDate.add(collector.pollInterval, 'seconds').toISOString(),
                    apiQuotaResetDate: null,
                    totalLogsCount: 0,
                    poll_interval_sec: 1
                };
                let nextState = collector._getNextCollectionState(curState);
                assert.equal(moment(nextState.until).diff(nextState.since, 'seconds'), collector.pollInterval);
                assert.equal(nextState.poll_interval_sec, 300);
                done();
            });
        });
    });

    describe('Format Tests', function () {
        it('log format success', function (done) {
            let ctx = {
                invokedFunctionArn: ciscoampMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };

            CiscoampCollector.load().then(function (creds) {
                var collector = new CiscoampCollector(ctx, creds, 'ciscoamp');
                let fmt = collector.pawsFormatLog(ciscoampMock.LOG_EVENT);
                assert.equal(fmt.progName, 'CiscoampCollector');
                assert.ok(fmt.message);
                done();
            });
        });
    });

    describe('NextCollectionStateWithNextPage', function () {
        it('Get Next Collection State With NextPage Success', function (done) {
            let ctx = {
                invokedFunctionArn: ciscoampMock.FUNCTION_ARN,
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
                resource: "AuditLogs",
                since: startDate.toISOString(),
                until: startDate.add(5, 'minutes').toISOString(),
                apiQuotaResetDate: null,
                poll_interval_sec: 1
            };
            const nextPage = "nextPageUrl";
            const totalLogsCount = "10";
            CiscoampCollector.load().then(function (creds) {
                var collector = new CiscoampCollector(ctx, creds, 'ciscoamp');
                let nextState = collector._getNextCollectionStateWithNextPage(curState, nextPage, totalLogsCount);
                assert.ok(nextState.nextPage);
                assert.equal(nextState.nextPage, nextPage);
                assert.equal(nextState.totalLogsCount, totalLogsCount);
                done();
            });
        });
    });

});
