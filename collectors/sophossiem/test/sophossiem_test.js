const assert = require('assert');
const sinon = require('sinon');
var AWS = require('aws-sdk-mock');
const m_response = require('cfn-response');
const sophossiemMock = require('./sophossiem_mock');
var SophossiemCollector = require('../collector').SophossiemCollector;
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

    describe('pawsInitCollectionState', function () {
        let ctx = {
            invokedFunctionArn: sophossiemMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('Paws Init Collection State with start date behind 22 hours Success', function (done) {
            SophossiemCollector.load().then(function (creds) {
                var collector = new SophossiemCollector(ctx, creds, 'sophossiem');
                const startDate = moment().subtract(22, 'hours').toISOString();
                process.env.paws_collection_start_ts = startDate;
                collector.pawsInitCollectionState({}, (err, initialStates, nextPoll) => {
                    initialStates.forEach((state) => {
                        assert.equal(state.poll_interval_sec, 1);
                        assert.ok(state.from_date);
                    });
                    done();
                });
            });
        });

        it('Paws Init Collection State with start date behind 2 days Success', function (done) {
            SophossiemCollector.load().then(function (creds) {
                var collector = new SophossiemCollector(ctx, creds, 'sophossiem');
                const startDate = moment().subtract(2, 'days').toISOString();
                process.env.paws_collection_start_ts = startDate;
                collector.pawsInitCollectionState({}, (err, initialStates, nextPoll) => {
                    initialStates.forEach((state) => {
                        assert.equal(state.poll_interval_sec, 1);
                        assert.ok(state.from_date);
                    });
                    done();
                });
            });
        });
    });

    describe('Paws Get Register Parameters', function () {
        it('Paws Get Register Parameters Success', function (done) {
            let ctx = {
                invokedFunctionArn: sophossiemMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };

            SophossiemCollector.load().then(function (creds) {
                var collector = new SophossiemCollector(ctx, creds, 'sophossiem');
                const sampleEvent = { ResourceProperties: { StackName: 'a-stack-name' } };
                collector.pawsGetRegisterParameters(sampleEvent, (err, regValues) => {
                    const expectedRegValues = {
                        sophossiemObjectNames: "[\"Events\", \"Alerts\"]",
                    };
                    assert.deepEqual(regValues, expectedRegValues);
                    done();
                });
            });
        });
    });

    describe('pawsGetLogs', function () {
        let ctx = {
            invokedFunctionArn: sophossiemMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('Paws Get Logs Success', function (done) {
            getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(
                function fakeFn(BaseAPIURL, headers, state, accumulator, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return resolve({ accumulator: [sophossiemMock.LOG_EVENT, sophossiemMock.LOG_EVENT], nextPage: "nextPage", has_more: false });
                    });
                });

            SophossiemCollector.load().then(function (creds) {
                var collector = new SophossiemCollector(ctx, creds, 'sophossiem');
                const startDate = moment().subtract(23, 'hours');
                const curState = {
                    objectName: "Events",
                    from_date: startDate.unix(),
                    poll_interval_sec: 1
                };
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(logs.length, 2);
                    assert.equal(newState.poll_interval_sec, 60);
                    assert.equal(newState.nextPage, "nextPage");
                    assert.ok(logs[0].id);
                    getAPILogs.restore();
                    done();
                });

            });
        });

        it('Paws Get Logs with has more true Success', function (done) {
            getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(
                function fakeFn(BaseAPIURL, headers, state, accumulator, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return resolve({ accumulator: [sophossiemMock.LOG_EVENT, sophossiemMock.LOG_EVENT], nextPage: "nextPage", has_more: true });
                    });
                });

            SophossiemCollector.load().then(function (creds) {
                var collector = new SophossiemCollector(ctx, creds, 'sophossiem');
                const curState = {
                    objectName: "Events",
                    nextPage: "nextPage",
                    poll_interval_sec: 1
                };
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(logs.length, 2);
                    assert.equal(newState.poll_interval_sec, 1);
                    assert.equal(newState.nextPage, "nextPage");
                    assert.ok(logs[0].id);
                    getAPILogs.restore();
                    done();
                });

            });
        });
    });

    describe('Next state tests', function () {
        let ctx = {
            invokedFunctionArn: sophossiemMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () {
            }
        };

        it('Next state tests success with has more false', function (done) {
            SophossiemCollector.load().then(function (creds) {
                var collector = new SophossiemCollector(ctx, creds, 'sophossiem');
                const startDate = moment();
                const curState = {
                    objectName: "Events",
                    from_date: startDate.unix(),
                    poll_interval_sec: 1
                };
                const nextPage = "nextPage";
                const has_more = false;
                let nextState = collector._getNextCollectionState(curState, nextPage, has_more);
                assert.equal(nextState.poll_interval_sec, collector.pollInterval);
                assert.equal(nextState.nextPage, "nextPage");
                done();
            });
        });

        it('Next state tests success with has more true', function (done) {
            SophossiemCollector.load().then(function (creds) {
                var collector = new SophossiemCollector(ctx, creds, 'sophossiem');
                const startDate = moment();
                const curState = {
                    objectName: "Events",
                    from_date: startDate.unix(),
                    poll_interval_sec: 1
                };
                const nextPage = "nextPage";
                const has_more = true;
                let nextState = collector._getNextCollectionState(curState, nextPage, has_more);
                assert.equal(nextState.poll_interval_sec, 1);
                assert.equal(nextState.nextPage, "nextPage");
                done();
            });
        });
    });

    describe('Format Tests', function () {
        it('log format success', function (done) {
            let ctx = {
                invokedFunctionArn: sophossiemMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };
            SophossiemCollector.load().then(function (creds) {
                var collector = new SophossiemCollector(ctx, creds, 'sophossiem');
                let fmt = collector.pawsFormatLog(sophossiemMock.LOG_EVENT);
                assert.equal(fmt.progName, 'SophossiemCollector');
                assert.ok(fmt.message);
                done();
            });
        });
    });
});
