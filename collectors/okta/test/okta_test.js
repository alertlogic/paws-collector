const assert = require('assert');
const sinon = require('sinon');
const moment = require('moment');
const nock = require('nock');
const m_response = require('@alertlogic/al-aws-collector-js').CfnResponse;
const okta = require('@okta/okta-sdk-nodejs');

const oktaMock = require('./okta_mock');
var m_alCollector = require('@alertlogic/al-collector-js');
var OktaCollector = require('../okta_collector').OktaCollector;
const m_al_aws = require('@alertlogic/al-aws-collector-js');
const { CloudWatch } = require("@aws-sdk/client-cloudwatch"),
    { KMS } = require("@aws-sdk/client-kms"),
    { SSM } = require("@aws-sdk/client-ssm");


var alserviceStub = {};
var responseStub = {};
var setEnvStub = {};
let stubOktaClient = {};
var stubListLogEvents = {};
var oktaClientMock = {};

function setAlServiceStub() {
    alserviceStub.get = sinon.stub(m_alCollector.AlServiceC.prototype, 'get').callsFake(
        function fakeFn(path, extraOptions) {
            return new Promise(function (resolve, reject) {
                var ret = null;
                switch (path) {
                    case '/residency/default/services/ingest/endpoint':
                        ret = {
                            ingest: 'new-ingest-endpoint'
                        };
                        break;
                    case '/residency/default/services/azcollect/endpoint':
                        ret = {
                            azcollect: 'new-azcollect-endpoint'
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
            return new Promise(function (resolve, reject) {
                return resolve();
            });
        });
    alserviceStub.del = sinon.stub(m_alCollector.AlServiceC.prototype, 'deleteRequest').callsFake(
        function fakeFn(path) {
            return new Promise(function (resolve, reject) {
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
    setEnvStub = sinon.stub(m_al_aws.AlAwsCommon, 'setEnvAsync').callsFake((vars) => {
        const {
            ingest_api,
            azcollect_api,
            collector_status_api
        } = vars;
        process.env.ingest_api = ingest_api ? ingest_api : process.env.ingest_api;
        process.env.azcollect_api = azcollect_api ? azcollect_api : process.env.azcollect_api;
        process.env.collector_status_api = collector_status_api ? collector_status_api : process.env.collector_status_api;
        const returnBody = {
            Environment: {
                Variables: vars
            }
        };
        return Promise.resolve(returnBody);
    });
}

describe('Unit Tests', function () {

    beforeEach(function () {
        if (!nock.isActive()) {
            nock.activate();
        }

        oktaClientMock = {
            systemLogApi: {
                listLogEvents: sinon.stub()
            }
        };
        stubOktaClient = sinon.stub(okta, 'Client').returns(oktaClientMock);

        stubListLogEvents = oktaClientMock.systemLogApi.listLogEvents;
        sinon.stub(SSM.prototype, 'getParameter').callsFake(function (params) {
            const data = Buffer.from('test-secret');
            return Promise.resolve({ Parameter: { Value: data.toString('base64') } });
        });

        sinon.stub(KMS.prototype, 'decrypt').callsFake(function (params) {
            const data = {
                Plaintext: Buffer.from('decrypted-sercret-key')
            };
            return Promise.resolve(data);
        });

        responseStub = sinon.stub(m_response, 'send').callsFake(
            function fakeFn(event, mockContext, responseStatus, responseData, physicalResourceId) {
                return Promise.resolve();
            });

        setAlServiceStub();
        mockSetEnvStub();
    });

    afterEach(function () {
        restoreAlServiceStub();
        setEnvStub.restore();
        responseStub.restore();
        KMS.prototype.decrypt.restore();
        SSM.prototype.getParameter.restore();
        stubOktaClient.restore();
    });

    describe('pawsInitCollectionState', function () {
        let ctx = {
            invokedFunctionArn: oktaMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('sets up intial state (startDate < now - pollInterval)', async function () {
            const creds = await OktaCollector.load();
            const testPollInterval = 60;
            var collector = new OktaCollector(ctx, creds);
            const startDate = moment().subtract(1, 'days').toISOString();
            process.env.paws_collection_start_ts = startDate;
            collector.pollInterval = testPollInterval;

            const { state, nextInvocationTimeout } = await collector.pawsInitCollectionState(oktaMock.LOG_EVENT);
            assert.equal(state.since, startDate, "Dates are not equal");
            assert.equal(moment(state.until).diff(state.since, 'seconds'), testPollInterval);
            assert.equal(state.poll_interval_sec, 1);
            assert.equal(nextInvocationTimeout, 1);
        });

        it('sets up intial state (now - pollInterval < startDate < now)', async function () {
            const creds = await OktaCollector.load();
            const testPollInterval = 300;
            var collector = new OktaCollector(ctx, creds);
            const startDate = moment().subtract(20, 'seconds').toISOString();
            process.env.paws_collection_start_ts = startDate;
            collector.pollInterval = testPollInterval;

            const { state, nextInvocationTimeout } = await collector.pawsInitCollectionState(oktaMock.LOG_EVENT);
            assert.equal(state.since, startDate, "Dates are not equal");
            assert.equal(moment(state.until).diff(state.since, 'seconds'), testPollInterval);
            assert.equal(state.poll_interval_sec, testPollInterval);
            assert.equal(nextInvocationTimeout, testPollInterval);
        });

        it('sets up intial state (startDate = now)', async function () {
            const creds = await OktaCollector.load();
            const testPollInterval = 300;
            var collector = new OktaCollector(ctx, creds);
            const startDate = moment().toISOString();
            process.env.paws_collection_start_ts = startDate;
            collector.pollInterval = testPollInterval;

            const { state, nextInvocationTimeout } = await collector.pawsInitCollectionState(oktaMock.LOG_EVENT);
            assert.equal(state.since, startDate, "Dates are not equal");
            assert.equal(moment(state.until).diff(state.since, 'seconds'), testPollInterval);
            assert.equal(state.poll_interval_sec, testPollInterval);
            assert.equal(nextInvocationTimeout, testPollInterval);
        });
    });

    describe('pawsGetLogs', function () {
        let ctx = {
            invokedFunctionArn: oktaMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('gets logs correctly', async function () {
            stubListLogEvents.callsFake(() => {
                return {
                    each: (callback) => {
                        ['foo', 'bar', 'baz'].forEach(callback);
                        return new Promise((res, rej) => {
                            res();
                        });
                    }
                };
            });
            try {
                const creds = await OktaCollector.load();
                var collector = new OktaCollector(ctx, creds);
                const startDate = moment().subtract(1, 'days').toISOString();
                const mockState = {
                    since: startDate,
                    until: moment().toISOString()
                };

                const [logs, newState] = await collector.pawsGetLogs(mockState);
                assert.equal(logs.length, 3);
                assert.equal(newState.since, mockState.until);
            } finally {
            }
        });

        it('it should return the same state with pollinterval delay if get api return throttle error', async function () {
            const error = { "name": "OktaApiError", "status": 429, "errorCode": "E0000047", "errorSummary": "API call exceeded rate limit due to too many requests.", "errorCauses": [], "errorLink": "E0000047", "errorId": "oaeJacBsJ0pQES61B_uegmlzA", "url": "https://alertlogic-admin.okta.com/api/v1/logs?since=2023-06-03T08%3A32%3A20.000Z&until=2023-06-03T08%3A33%3A20.000Z", "headers": {}, "message": "Okta HTTP 429 E0000047 API call exceeded rate limit due to too many requests.. " };
            stubListLogEvents.callsFake(() => {
                return {
                    each: () => {
                        return new Promise((res, rej) => {
                            rej(error);
                        });
                    }
                };
            });
            let putMetricDataStub;
            try {
                const creds = await OktaCollector.load();
                var collector = new OktaCollector(ctx, creds);
                const startDate = moment().subtract(1, 'days').toISOString();
                const mockState = {
                    since: startDate,
                    until: moment().toISOString(),
                    poll_interval_sec: 60
                };
                var reportSpy = sinon.spy(collector, 'reportApiThrottling');
                putMetricDataStub = sinon.stub(CloudWatch.prototype, 'putMetricData').callsFake((params) => Promise.resolve());
                const [logs, state, pollIntervalSec] = await collector.pawsGetLogs(mockState);
                assert.equal(true, reportSpy.calledOnce);
                assert.deepEqual(logs, []);
                assert.equal(state, mockState);
                // if header not return rate-limit-resect-sec then add the 60 sec in existing pollinterval seconds
                assert.equal(pollIntervalSec, 120);
            } finally {
                if (putMetricDataStub) {
                    putMetricDataStub.restore();
                }
            }
        });
        it('It should set the delay second if there is throttle error and header contain X-Rate-Limit-Reset', async function () {
            const resetSecs = moment().add(120, 'seconds').unix();
            const error = { "name": "OktaApiError", "status": 429, "errorCode": "E0000047", "errorSummary": "API call exceeded rate limit due to too many requests.", "url": "https://alertlogic-admin.okta.com/api/v1/logs?since=2023-06-03T08%3A32%3A20.000Z&until=2023-06-03T08%3A33%3A20.000Z", "headers": { "x-rate-limit-reset": resetSecs }, "message": "Okta HTTP 429 E0000047 API call exceeded rate limit due to too many requests.. " };
            stubListLogEvents.callsFake(() => {
                return {
                    each: () => {
                        return new Promise((res, rej) => {
                            rej(error);
                        });
                    }
                };
            });
            let putMetricDataStub;
            try {
                const creds = await OktaCollector.load();
                var collector = new OktaCollector(ctx, creds);
                const startDate = moment().subtract(1, 'days').toISOString();
                const mockState = {
                    since: startDate,
                    until: moment().toISOString(),
                    poll_interval_sec: 60
                };
                var reportSpy = sinon.spy(collector, 'reportApiThrottling');
                putMetricDataStub = sinon.stub(CloudWatch.prototype, 'putMetricData').callsFake((params) => Promise.resolve());
                const [logs, state, poll_interval_sec] = await collector.pawsGetLogs(mockState);
                // Perform assertions
                assert.equal(true, reportSpy.calledOnce);
                assert.deepEqual(logs, []);
                assert.equal(state, mockState);
                assert.equal(poll_interval_sec, 180);
            } finally {
                if (putMetricDataStub) {
                    putMetricDataStub.restore();
                }
            }
        });

        it('gets logs throttling response', async function () {

            // Okta endpoints mock
            const error = { "name": "OktaApiError", "status": 429, "errorCode": "E0000047", "errorSummary": "API call exceeded rate limit due to too many requests.", "url": "https://alertlogic-admin.okta.com/api/v1/logs?since=2023-06-03T08%3A32%3A20.000Z&until=2023-06-03T08%3A33%3A20.000Z", "message": "Okta HTTP 429 E0000047 API call exceeded rate limit due to too many request" };
            stubListLogEvents.callsFake(() => {
                return {
                    each: () => {
                        return new Promise((res, rej) => {
                            rej(error);
                        });
                    }
                };
            });
            let putMetricDataStub;
            try {
                const creds = await OktaCollector.load();
                var collector = new OktaCollector(ctx, creds);
                const startDate = moment().subtract(1, 'days').toISOString();
                const mockState = {
                    since: startDate,
                    until: moment().toISOString()
                };
                var reportSpy = sinon.spy(collector, 'reportApiThrottling');
                putMetricDataStub = sinon.stub(CloudWatch.prototype, 'putMetricData').callsFake((params) => Promise.resolve());
                await collector.pawsGetLogs(mockState);
                assert.equal(true, reportSpy.calledOnce);
            } finally {
                if (putMetricDataStub) {
                    putMetricDataStub.restore();
                }
            }
        });
    });

    describe('_getNextCollectionState', function () {
        let ctx = {
            invokedFunctionArn: oktaMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('sets the correct since if the last until is in the future', function (done) {
            const startDate = moment();
            const curState = {
                since: startDate.toISOString(),
                until: startDate.add(2, 'days').toISOString(),
                poll_interval_sec: 1
            };
            OktaCollector.load().then(function (creds) {
                const testPollInterval = 300;
                var collector = new OktaCollector(ctx, creds, 'okta');
                collector.pollInterval = testPollInterval;
                const newState = collector._getNextCollectionState(curState);
                assert.notEqual(moment(newState.until).toISOString(), curState.until);
                assert.equal(newState.poll_interval_sec, collector.pollInterval);
                done();
            });
        });
    });


    describe('Format Tests', function () {
        it('log format success', function (done) {
            let ctx = {
                invokedFunctionArn: oktaMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };

            OktaCollector.load().then(function (creds) {
                var collector = new OktaCollector(ctx, creds);
                let fmt = collector.pawsFormatLog(oktaMock.OKTA_LOG_EVENT);
                assert.equal(fmt.progName, 'OktaCollector');
                assert.ok(fmt.messageTypeId);
                done();
            });
        });

        it('redacts sensitive fields', function (done) {
            let ctx = {
                invokedFunctionArn: oktaMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };

            OktaCollector.load().then(function (creds) {
                var collector = new OktaCollector(ctx, creds);
                let fmt = collector.pawsFormatLog(oktaMock.OKTA_LOG_EVENT);
                let msg = JSON.parse(fmt.message);
                assert.equal(msg.client.apiToken, undefined);
                assert.equal(msg.client.http.defaultHeaders.Authorization, undefined);
                assert.ok(fmt.messageTypeId);
                done();
            });
        });

        it('formats message if sensitive fields not present', function (done) {
            let ctx = {
                invokedFunctionArn: oktaMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };

            OktaCollector.load().then(function (creds) {
                var collector = new OktaCollector(ctx, creds);
                let fmt = collector.pawsFormatLog({ eventType: "value" });
                assert.ok(fmt.messageTypeId);
                done();
            });
        });

        it('no error code', async function () {
            let errorObj = {
                status: 401,
                url: "https://ft-test.oktapreview.com/api/v1/logs?since=2020-08-13T20%3A00%3A04.000Z&until=2020-08-13T20%3A01%3A04.000Z"
            };
            let ctx = {
                invokedFunctionArn: oktaMock.FUNCTION_ARN,
                fail: function (error) { },
                succeed: function () { }
            };
            stubListLogEvents.callsFake(() => {
                return {
                    each: (callback) => {
                        ['foo', 'bar', 'baz'].forEach(callback);
                        return new Promise((res, rej) => {
                            rej(errorObj);
                        });
                    }
                };
            });
            try {
                const creds = await OktaCollector.load();
                var collector = new OktaCollector(ctx, creds);
                const startDate = moment().subtract(1, 'days').toISOString();
                const mockState = {
                    since: startDate,
                    until: moment().toISOString()
                };

                await assert.rejects(
                    collector.pawsGetLogs(mockState),
                    (err) => {
                        assert.equal(err.status, 401);
                        assert.equal(err.errorCode, 401);
                        return true;
                    }
                );
            } finally {
            }
        });
    });
});
