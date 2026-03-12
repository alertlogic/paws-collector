const assert = require('assert');
const sinon = require('sinon');
const m_response = require('@alertlogic/al-aws-collector-js').CfnResponse;
const moment = require('moment');

const gsuiteMock = require('./gsuite_mock');
var GsuiteCollector = require('../collector').GsuiteCollector;
const utils = require("../utils");
const { GoogleAuth } = require("google-auth-library");

const { CloudWatch } = require("@aws-sdk/client-cloudwatch"),
    { KMS } = require("@aws-sdk/client-kms"),
    { SSM } = require("@aws-sdk/client-ssm");

var responseStub = {};
let listEvent;
let listAlert;
let mockAuthenticationObject;

function setAlServiceStub() {
    mockAuthenticationObject = sinon.stub(GoogleAuth.prototype, 'getClient').callsFake(
        function fakeFn(path) {
            return Promise.resolve({});
        });
}

function restoreAlServiceStub() {
    mockAuthenticationObject.restore();
}
describe('Unit Tests', function () {

    beforeEach(function () {
        sinon.stub(SSM.prototype, 'getParameter').callsFake(function (params) {
            const data = Buffer.from('test-secret');
            return Promise.resolve({ Parameter: { Value: data.toString('base64') } });
        });
        sinon.stub(KMS.prototype, 'decrypt').callsFake(function (params) {
            const data = {
                Plaintext: Buffer.from('{}')
            };
            return Promise.resolve(data);
        });

        responseStub = sinon.stub(m_response, 'send').callsFake(
            function fakeFn(event, mockContext, responseStatus, responseData, physicalResourceId) {
                return Promise.resolve();
            });

        setAlServiceStub();
    });

    afterEach(function () {
        restoreAlServiceStub();
        responseStub.restore();
        KMS.prototype.decrypt.restore();
        SSM.prototype.getParameter.restore();
    });

    describe('Paws Init Collection State', function () {
        let ctx = {
            invokedFunctionArn: gsuiteMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('get inital state less than 7 days in the past', async function () {
            const creds = await GsuiteCollector.load();
            var collector = new GsuiteCollector(ctx, creds, 'gsuite');
            const startDate = moment().subtract(1, 'days').toISOString();
            process.env.paws_collection_start_ts = startDate;

            const { state: initialStates } = await collector.pawsInitCollectionState(null);
            initialStates.forEach((state) => {
                assert.equal(state.since, startDate, "Dates are not equal");
                assert.notEqual(moment(state.until).diff(state.since, 'hours'), 24);
            });
        });
        it('get inital state less than 24 hours in the past', async function () {
            const creds = await GsuiteCollector.load();
            var collector = new GsuiteCollector(ctx, creds, 'gsuite');
            const startDate = moment().subtract(12, 'hours').toISOString();
            process.env.paws_collection_start_ts = startDate;

            const { state: initialStates } = await collector.pawsInitCollectionState(null);
            initialStates.forEach((state) => {
                assert.notEqual(moment(state.until).diff(state.since, 'hours'), 24);
            });
        });

    });

    describe('Paws Get Register Parameters', function () {
        it('Paws Get Register Parameters Success', async function () {
            let ctx = {
                invokedFunctionArn: gsuiteMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                },
                succeed: function () { }
            };

            const creds = await GsuiteCollector.load();
            var collector = new GsuiteCollector(ctx, creds, 'gsuite');
            const sampleEvent = { ResourceProperties: { StackName: 'a-stack-name' } };
            const regValues = await collector.pawsGetRegisterParameters(sampleEvent);
            const expectedRegValues = {
                gsuiteScope: '["gsuiteScope"]',
                gsuiteApplicationNames: '["login","admin","token"]'
            };
            assert.deepEqual(regValues, expectedRegValues);
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
        it('Paws Get Logs Success', async function () {
            listEvent = sinon.stub(utils, 'listEvents').callsFake(
                function fakeFn(path) {
                    return new Promise(function (resolve, reject) {
                        return resolve({ accumulator: [gsuiteMock.LOG_EVENT, gsuiteMock.LOG_EVENT] });
                    });
                });

            try {
                const creds = await GsuiteCollector.load();
                var collector = new GsuiteCollector(ctx, creds, 'gsuite');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    application: "login",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    poll_interval_sec: 1
                };

                const [logs, newState] = await collector.pawsGetLogs(curState);
                assert.equal(logs.length, 2);
                assert.equal(newState.poll_interval_sec, 1);
                assert.ok(logs[0].kind);
            } finally {
                listEvent.restore();
            }
        });

        it('Paws Get Logs Success Alerts', async function () {
            listAlert = sinon.stub(utils, 'listAlerts').callsFake(
                function fakeFn(path) {
                    return new Promise(function (resolve, reject) {
                        return resolve({ accumulator: [gsuiteMock.LOG_ALERT, gsuiteMock.LOG_ALERT] });
                    });
                });

            try {
                const creds = await GsuiteCollector.load();
                var collector = new GsuiteCollector(ctx, creds, 'gsuite');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    application: "alerts",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    poll_interval_sec: 1
                };

                const [logs, newState] = await collector.pawsGetLogs(curState);
                assert.equal(logs.length, 2);
                assert.equal(newState.poll_interval_sec, 1);
                assert.ok(logs[0].data['@type']);
            } finally {
                listAlert.restore();
            }
        });

        it('Paws Get Logs with API Quota Reset Date', async function () {
            listEvent = sinon.stub(utils, 'listEvents').callsFake(
                function fakeFn(path) {
                    return new Promise(function (resolve, reject) {
                        return resolve({ accumulator: [gsuiteMock.LOG_EVENT, gsuiteMock.LOG_EVENT] });
                    });
                });

            let putMetricDataStub;
            try {
                const creds = await GsuiteCollector.load();
                var collector = new GsuiteCollector(ctx, creds, 'gsuite');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    application: "login",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    apiQuotaResetDate: moment().add(1, 'days').toISOString(),
                    poll_interval_sec: 900
                };

                var reportSpy = sinon.spy(collector, 'reportApiThrottling');
                putMetricDataStub = sinon.stub(CloudWatch.prototype, 'putMetricData').callsFake(() => Promise.resolve());

                const [logs, newState] = await collector.pawsGetLogs(curState);
                assert.equal(true, reportSpy.calledOnce);
                assert.equal(logs.length, 0);
                assert.equal(newState.poll_interval_sec, 900);
            } finally {
                listEvent.restore();
                if (putMetricDataStub) {
                    putMetricDataStub.restore();
                }
            }
        });
        it('Paws Get Logs check throttling error', async function () {
            listEvent = sinon.stub(utils, 'listEvents').callsFake(
                function fakeFn(path) {
                    return new Promise(function (resolve, reject) {
                        return reject({ errors: [ { reason: "dailyLimitExceeded"}] });
                    });
                });

            let putMetricDataStub;
            try {
                const creds = await GsuiteCollector.load();
                var collector = new GsuiteCollector(ctx, creds, 'gsuite');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    application: "login",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    poll_interval_sec: 1
                };

                var reportSpy = sinon.spy(collector, 'reportApiThrottling');
                putMetricDataStub = sinon.stub(CloudWatch.prototype, 'putMetricData').callsFake(() => Promise.resolve());
                const [logs, newState] = await collector.pawsGetLogs(curState);
                assert.equal(true, reportSpy.calledOnce);
                assert.equal(logs.length, 0);
                assert.equal(newState.poll_interval_sec, 900);
            } finally {
                listEvent.restore();
                if (putMetricDataStub) {
                    putMetricDataStub.restore();
                }
            }
        });

        it('Paws Get Logs check client error', async function () {
            listEvent = sinon.stub(utils, 'listEvents').callsFake(
                function fakeFn(path) {
                    return new Promise(function (resolve, reject) {
                        return reject({ code: 403,
                            errors:
                             [ { message: 'Insufficient Permission',
                                 domain: 'global',
                                 reason: 'insufficientPermissions' } ]  });
                    });
                });

            try {
                const creds = await GsuiteCollector.load();
                var collector = new GsuiteCollector(ctx, creds, 'gsuite');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    application: "login",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    poll_interval_sec: 1
                };

                try {
                    await collector.pawsGetLogs(curState);
                    assert.fail('Expected pawsGetLogs to reject');
                } catch (err) {
                    assert.equal(err.errorCode, 'insufficientPermissions');
                }
            } finally {
                listEvent.restore();
            }
        });

        it('Paws Get Logs Success Context Aware Access', async function () {
            listEvent = sinon.stub(utils, 'listEvents').callsFake(
                function fakeFn(path) {
                    return new Promise(function (resolve, reject) {
                        gsuiteMock.LOG_EVENT.events[0].type='context_aware_access';
                        return resolve({ accumulator: [gsuiteMock.LOG_EVENT, gsuiteMock.LOG_EVENT] });
                    });
                });

            try {
                const creds = await GsuiteCollector.load();
                var collector = new GsuiteCollector(ctx, creds, 'gsuite');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    application: "context_aware_access",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    poll_interval_sec: 1
                };

                const [logs, newState] = await collector.pawsGetLogs(curState);
                assert.equal(logs.length, 2);
                assert.equal(newState.poll_interval_sec, 1);
                assert.ok(logs[0].kind);
            } finally {
                listEvent.restore();
            }
        });

    

    });


    describe('Format Tests', function () {
        it('Log Format Tests Success', async function () {
            let ctx = {
                invokedFunctionArn: gsuiteMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                },
                succeed: function () { }
            };

            const creds = await GsuiteCollector.load();
            var collector = new GsuiteCollector(ctx, creds, 'gsuite');
            let fmt;
            if (collector.streams === 'alerts') {
                fmt = collector.pawsFormatLog(gsuiteMock.LOG_ALERT);
            } else {
                fmt = collector.pawsFormatLog(gsuiteMock.LOG_EVENT);
            }
            assert.equal(fmt.progName, 'GsuiteCollector');
            assert.ok(fmt.messageTypeId);
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
        it('get next state if more than 24 hours in the past', async function () {
            const startDate = moment().subtract(10, 'days');
            const curState = {
                since: startDate.toISOString(),
                until: startDate.add(5, 'days').toISOString(),
                poll_interval_sec: 1
            };
            const creds = await GsuiteCollector.load();
            var collector = new GsuiteCollector(ctx, creds, 'gsuite');
            const newState = collector._getNextCollectionState(curState);
            assert.equal(moment(newState.until).diff(newState.since, 'hours'), 24);
            assert.equal(newState.poll_interval_sec, 1);
        });

        it('get next state if less than 1 hour in the past but more than the polling interval', async function () {
            const startDate = moment().subtract(20, 'minutes');
            const creds = await GsuiteCollector.load();
            var collector = new GsuiteCollector(ctx, creds, 'gsuite');
            const curState = {
                since: startDate.toISOString(),
                until: startDate.add(collector.pollInterval, 'seconds').toISOString(),
                poll_interval_sec: 1
            };
            const newState = collector._getNextCollectionState(curState);
            assert.equal(moment(newState.until).diff(newState.since, 'seconds'), collector.pollInterval);
            assert.equal(newState.poll_interval_sec, 1);
        });

        it('get next state if within polling interval', async function () {
            const creds = await GsuiteCollector.load();
            var collector = new GsuiteCollector(ctx, creds, 'gsuite');
            const startDate = moment().subtract(collector.pollInterval * 2, 'seconds');
            const curState = {
                since: startDate.toISOString(),
                until: startDate.add(collector.pollInterval, 'seconds').toISOString(),
                poll_interval_sec: 1
            };
            const newState = collector._getNextCollectionState(curState);
            assert.equal(moment(newState.until).diff(newState.since, 'seconds'), collector.pollInterval);
            assert.equal(newState.poll_interval_sec, 300);
        });
    });

    describe('NextCollectionStateWithNextPage', function () {
        it('Get Next Collection State With NextPage Success', async function () {
            let ctx = {
                invokedFunctionArn: gsuiteMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                },
                succeed: function () { }
            };

            const startDate = moment().subtract(5, 'minutes');
            const curState = {
                application: "login",
                since: startDate.toISOString(),
                until: startDate.add(5, 'minutes').toISOString(),
                poll_interval_sec: 1
            };
            const nextPage = "nextPageToken";
            const creds = await GsuiteCollector.load();
            var collector = new GsuiteCollector(ctx, creds, 'gsuite');
            let nextState = collector._getNextCollectionStateWithNextPage(curState, nextPage);
            assert.ok(nextState.since);
        });
    });
});
