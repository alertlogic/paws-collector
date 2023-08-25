const assert = require('assert');
const sinon = require('sinon');
var AWS = require('aws-sdk-mock');
const m_response = require('cfn-response');
const sentineloneMock = require('./sentinelone_mock');
var SentineloneCollector = require('../collector').SentineloneCollector;
const moment = require('moment');
const utils = require("../utils");

var responseStub = {};
let getAPILogs;

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
        responseStub.restore();
    });

    describe('Paws Init Collection State', function () {
        let ctx = {
            invokedFunctionArn: sentineloneMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('Paws Init Collection State Success', function (done) {
            SentineloneCollector.load().then(function (creds) {
                var collector = new SentineloneCollector(ctx, creds, 'sentinelone');
                const startDate = moment().subtract(1, 'days').toISOString();
                process.env.paws_collection_start_ts = startDate;
                collector.pawsInitCollectionState(null, (err, initialState, nextPoll) => {
                    assert.equal(moment(initialState.until).diff(initialState.since, 'seconds'), 60);
                    done();
                });
            });
        });
    });

    describe('pawsGetLogs', function () {
        let ctx = {
            invokedFunctionArn: sentineloneMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('Paws Get Logs Success', function (done) {
            getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(
                function fakeFn(baseUrl, token, params, accumulator, paws_max_pages_per_invocation) {
                    return new Promise(function (resolve, reject) {
                        return resolve({ accumulator: [sentineloneMock.LOG_EVENT, sentineloneMock.LOG_EVENT] });
                    });
                });
            SentineloneCollector.load().then(function (creds) {
                var collector = new SentineloneCollector(ctx, creds, 'sentinelone');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    nextPage: null,
                    poll_interval_sec: 1
                };
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(logs.length, 2);
                    assert.equal(newState.poll_interval_sec, 1);
                    assert.ok(logs[0].id);
                    getAPILogs.restore();
                    done();
                });

            });
        });
        it('Paws Get Logs with nextPage Success', function (done) {
            getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(
                function fakeFn(baseUrl, token, params, accumulator, paws_max_pages_per_invocation) {
                    return new Promise(function (resolve, reject) {
                        return resolve({ accumulator: [sentineloneMock.LOG_EVENT, sentineloneMock.LOG_EVENT], nextPage: "nextPage" });
                    });
                });
            SentineloneCollector.load().then(function (creds) {
                var collector = new SentineloneCollector(ctx, creds, 'sentinelone');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    nextPage: null,
                    poll_interval_sec: 1
                };
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(logs.length, 2);
                    assert.equal(newState.poll_interval_sec, 1);
                    assert.ok(logs[0].id);
                    getAPILogs.restore();
                    done();
                });
            });
        });

        it('Paws Get Logs failed and show client errors', function (done) {
            getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(
                function fakeFn(baseUrl, token, params, accumulator, paws_max_pages_per_invocation) {
                    return new Promise(function (resolve, reject) {
                        return reject({
                            response: {
                                status: 401, data:
                                    { "errors": [{ "code": 4010010, "detail": null, "title": "Authentication Failed" }] }
                            }
                        });
                    });
                });
            SentineloneCollector.load().then(function (creds) {
                var collector = new SentineloneCollector(ctx, creds, 'sentinelone');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    nextPage: null,
                    poll_interval_sec: 1
                };
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(err.errorCode, 4010010);
                    getAPILogs.restore();
                    done();
                });
            });
        });
    });

    describe('Next state tests', function () {
        it('log format success', function (done) {
            let ctx = {
                invokedFunctionArn: sentineloneMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };

            SentineloneCollector.load().then(function (creds) {
                var collector = new SentineloneCollector(ctx, creds, 'sentinelone');
                const startDate = moment();
                const curState = {
                    since: startDate.toISOString(),
                    until: startDate.add(collector.pollInterval, 'seconds').toISOString(),
                    poll_interval_sec: 1
                };
                let nextState = collector._getNextCollectionState(curState);
                assert.equal(moment(nextState.until).diff(nextState.since, 'seconds'), collector.pollInterval);
                assert.equal(nextState.poll_interval_sec, process.env.paws_poll_interval_delay);
                done();
            });
        });
    });

    describe('Format Tests', function () {
        it('log format success', function (done) {
            let ctx = {
                invokedFunctionArn: sentineloneMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };

            SentineloneCollector.load().then(function (creds) {
                var collector = new SentineloneCollector(ctx, creds, 'sentinelone');
                let fmt = collector.pawsFormatLog(sentineloneMock.LOG_EVENT);
                assert.equal(fmt.progName, 'SentineloneCollector');
                assert.ok(fmt.message);
                done();
            });
        });
    });

    describe('NextCollectionStateWithNextPage', function () {
        it('Get Next Collection State With NextPage Success', function (done) {
            let ctx = {
                invokedFunctionArn: sentineloneMock.FUNCTION_ARN,
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
                since: startDate.toISOString(),
                until: startDate.add(5, 'minutes').toISOString(),
                poll_interval_sec: 1
            };
            const nextPage = "cursor";
            SentineloneCollector.load().then(function (creds) {
                var collector = new SentineloneCollector(ctx, creds, 'sentinelone');
                let nextState = collector._getNextCollectionStateWithNextPage(curState, nextPage);
                assert.ok(nextState.nextPage);
                assert.equal(nextState.nextPage, nextPage);
                done();
            });
        });
    });
});
