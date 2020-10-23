const assert = require('assert');
const sinon = require('sinon');
var AWS = require('aws-sdk-mock');
const m_response = require('cfn-response');
const moment = require('moment');

const gsuiteMock = require('./gsuite_mock');
var GsuiteCollector = require('../collector').GsuiteCollector;
const utils = require("../utils");
const { auth } = require("google-auth-library");


var responseStub = {};
let listEvent;
let authenticationT;

function setAlServiceStub() {
    authenticationT = sinon.stub(auth, 'fromJSON').callsFake(
        function fakeFn(path) {
            return {};
        });
}

function restoreAlServiceStub() {
    authenticationT.restore();
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

        setAlServiceStub();
    });

    afterEach(function () {
        restoreAlServiceStub();
        responseStub.restore();
    });

    describe('Paws Init Collection State', function () {
        let ctx = {
            invokedFunctionArn: gsuiteMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('get inital state less than 7 days in the past', function (done) {
            GsuiteCollector.load().then(function (creds) {
                var collector = new GsuiteCollector(ctx, creds, 'gsuite');
                const startDate = moment().subtract(1, 'days').toISOString();
                process.env.paws_collection_start_ts = startDate;

                collector.pawsInitCollectionState(null, (err, initialStates, nextPoll) => {
                    initialStates.forEach((state) => {
                        assert.equal(state.since, startDate, "Dates are not equal");
                        assert.notEqual(moment(state.until).diff(state.since, 'hours'), 24);
                    });
                    done();
                });
            });
        });
        it('get inital state less than 24 hours in the past', function (done) {
            GsuiteCollector.load().then(function (creds) {
                var collector = new GsuiteCollector(ctx, creds, 'gsuite');
                const startDate = moment().subtract(12, 'hours').toISOString();
                process.env.paws_collection_start_ts = startDate;

                collector.pawsInitCollectionState(null, (err, initialStates, nextPoll) => {
                    initialStates.forEach((state) => {
                        assert.notEqual(moment(state.until).diff(state.since, 'hours'), 24);
                    });
                    done();
                });
            });
        });

    });

    describe('Paws Get Register Parameters', function () {
        it('Paws Get Register Parameters Success', function (done) {
            let ctx = {
                invokedFunctionArn: gsuiteMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };

            GsuiteCollector.load().then(function (creds) {
                var collector = new GsuiteCollector(ctx, creds, 'gsuite');
                const sampleEvent = { ResourceProperties: { StackName: 'a-stack-name' } };
                collector.pawsGetRegisterParameters(sampleEvent, (err, regValues) => {
                    const expectedRegValues = {
                        gsuiteScope: '["gsuiteScope"]',
                        gsuiteApplicationNames: '["login","admin","token"]'
                    };
                    assert.deepEqual(regValues, expectedRegValues);
                    done();
                });
            });
        });
    });

    describe('pawsGetLogs', function () {
        let ctx = {
            invokedFunctionArn: gsuiteMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('Paws Get Logs Success', function (done) {
            listEvent = sinon.stub(utils, 'listEvents').callsFake(
                function fakeFn(path) {
                    return new Promise(function (resolve, reject) {
                        return resolve({ accumulator: [gsuiteMock.LOG_EVENT, gsuiteMock.LOG_EVENT] });
                    });
                });

            GsuiteCollector.load().then(function (creds) {
                var collector = new GsuiteCollector(ctx, creds, 'gsuite');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    application: "login",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    poll_interval_sec: 1
                };

                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(logs.length, 2);
                    assert.equal(newState.poll_interval_sec, 1);
                    assert.ok(logs[0].kind);
                    listEvent.restore();
                    done();
                });

            });
        });

        it('Paws Get Logs with API Quota Reset Date', function (done) {
            listEvent = sinon.stub(utils, 'listEvents').callsFake(
                function fakeFn(path) {
                    return new Promise(function (resolve, reject) {
                        return resolve({ accumulator: [gsuiteMock.LOG_EVENT, gsuiteMock.LOG_EVENT] });
                    });
                });

            GsuiteCollector.load().then(function (creds) {
                var collector = new GsuiteCollector(ctx, creds, 'gsuite');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    application: "login",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    apiQuotaResetDate: moment().add(1, 'days').toISOString(),
                    poll_interval_sec: 900
                };

                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(logs.length, 0);
                    assert.equal(newState.poll_interval_sec, 900);
                    listEvent.restore();
                    done();
                });

            });
        });
        it('Paws Get Logs check throttling error', function (done) {
            listEvent = sinon.stub(utils, 'listEvents').callsFake(
                function fakeFn(path) {
                    return new Promise(function (resolve, reject) {
                        return reject({ errors: [ { reason: "dailyLimitExceeded"}] });
                    });
                });

            GsuiteCollector.load().then(function (creds) {
                var collector = new GsuiteCollector(ctx, creds, 'gsuite');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    application: "login",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    poll_interval_sec: 1
                };

                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(logs.length, 0);
                    assert.equal(newState.poll_interval_sec, 900);
                    listEvent.restore();
                    done();
                });

            });
        });
    });


    describe('Format Tests', function () {
        it('Log Format Tests Success', function (done) {
            let ctx = {
                invokedFunctionArn: gsuiteMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };

            GsuiteCollector.load().then(function (creds) {
                var collector = new GsuiteCollector(ctx, creds, 'gsuite');
                let fmt = collector.pawsFormatLog(gsuiteMock.LOG_EVENT);
                assert.equal(fmt.progName, 'GsuiteCollector');
                assert.ok(fmt.messageTypeId);
                done();
            });
        });
    });

    describe('Next State Tests', function () {
        let ctx = {
            invokedFunctionArn: gsuiteMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('get next state if more than 24 hours in the past', function (done) {
            const startDate = moment().subtract(10, 'days');
            const curState = {
                since: startDate.toISOString(),
                until: startDate.add(5, 'days').toISOString(),
                poll_interval_sec: 1
            };
            GsuiteCollector.load().then(function (creds) {
                var collector = new GsuiteCollector(ctx, creds, 'gsuite');
                const newState = collector._getNextCollectionState(curState);
                assert.equal(moment(newState.until).diff(newState.since, 'hours'), 24);
                assert.equal(newState.poll_interval_sec, 1);
                done();
            });
        });

        it('get next state if less than 1 hour in the past but more than the polling interval', function (done) {
            const startDate = moment().subtract(20, 'minutes');
            GsuiteCollector.load().then(function (creds) {
                var collector = new GsuiteCollector(ctx, creds, 'gsuite');
                const curState = {
                    since: startDate.toISOString(),
                    until: startDate.add(collector.pollInterval, 'seconds').toISOString(),
                    poll_interval_sec: 1
                };
                const newState = collector._getNextCollectionState(curState);
                assert.equal(moment(newState.until).diff(newState.since, 'seconds'), collector.pollInterval);
                assert.equal(newState.poll_interval_sec, 1);
                done();
            });
        });

        it('get next state if within polling interval', function (done) {
            GsuiteCollector.load().then(function (creds) {
                var collector = new GsuiteCollector(ctx, creds, 'gsuite');
                const startDate = moment().subtract(collector.pollInterval * 2, 'seconds');
                const curState = {
                    since: startDate.toISOString(),
                    until: startDate.add(collector.pollInterval, 'seconds').toISOString(),
                    poll_interval_sec: 1
                };
                const newState = collector._getNextCollectionState(curState);
                assert.equal(moment(newState.until).diff(newState.since, 'seconds'), collector.pollInterval);
                assert.equal(newState.poll_interval_sec, collector.pollInterval);
                done();
            });
        });
    });

    describe('NextCollectionStateWithNextPage', function () {
        it('Get Next Collection State With NextPage Success', function (done) {
            let ctx = {
                invokedFunctionArn: gsuiteMock.FUNCTION_ARN,
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
                application: "login",
                since: startDate.toISOString(),
                until: startDate.add(5, 'minutes').toISOString(),
                poll_interval_sec: 1
            };
            const nextPage = "nextPageToken";
            GsuiteCollector.load().then(function (creds) {
                var collector = new GsuiteCollector(ctx, creds, 'gsuite');
                let nextState = collector._getNextCollectionStateWithNextPage(curState, nextPage);
                assert.ok(nextState.since);
                done();
            });
        });
    });
});
