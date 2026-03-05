const assert = require('assert');
const sinon = require('sinon');
const moment = require('moment');
const m_response = require('@alertlogic/al-aws-collector-js').CfnResponse;

const auth0Mock = require('./auth0_mock');
var m_alCollector = require('@alertlogic/al-collector-js');
var Auth0Collector = require('../auth0_collector').Auth0Collector;
const m_al_aws = require('@alertlogic/al-aws-collector-js');
const utils = require("../utils");

const { CloudWatch } = require("@aws-sdk/client-cloudwatch"),
    { KMS } = require("@aws-sdk/client-kms"),
    { SSM } = require("@aws-sdk/client-ssm");

var alserviceStub = {};
var responseStub = {};
var setEnvStub = {};

let getAPILogs;

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
                    case '/residency/default/services/collectors_status/endpoint':
                        ret = {
                            collector_status: 'new-collector_status-endpoint'
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
    alserviceStub.put = sinon.stub(m_alCollector.AlServiceC.prototype, 'put').callsFake(
        function fakeFn(path) {
            return new Promise(function (resolve, reject) {
                return resolve();
            });
        });
}

function restoreAlServiceStub() {
    alserviceStub.get.restore();
    alserviceStub.post.restore();
    alserviceStub.put.restore();
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
        process.env.azollect_api = azcollect_api ? azcollect_api : process.env.azollect_api;
        process.env.collector_status_api = collector_status_api ? collector_status_api : process.env.collector_status_api;
        const returnBody = {
            Environment: {
                Varaibles: vars
            }
        };
        return Promise.resolve(returnBody);
    });
}

describe('Unit Tests', function () {

    beforeEach(function () {
        sinon.stub(SSM.prototype, 'getParameter').callsFake(function (params) {
            const data = process.env.ssm_direct ? 'decrypted-aims-sercret-key' : Buffer.from('decrypted-aims-sercret-key');
            return Promise.resolve({ Parameter: { Value: process.env.ssm_direct ? data : data.toString('base64') } });
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
    });

    describe('pawsInitCollectionState', function () {
        let ctx = {
            invokedFunctionArn: auth0Mock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('sets up intial state', function () {
            return Auth0Collector.load().then(function (creds) {
                const testPollInterval = 60;
                var collector = new Auth0Collector(ctx, creds);
                const startDate = moment().subtract(1, 'days').toISOString();
                process.env.paws_collection_start_ts = startDate;
                collector.pollInterval = testPollInterval;

                return collector.pawsInitCollectionState({}).then(({state, nextInvocationTimeout}) => {
                    assert.equal(state.since, startDate, "Dates are not equal");
                    assert.equal(state.poll_interval_sec, 1);
                    assert.equal(nextInvocationTimeout, 1);
                });
            });
        });
    });
    describe('Format Tests', function () {
        it('log format success', function () {
            let ctx = {
                invokedFunctionArn: auth0Mock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                },
                succeed: function () {
                }
            };

            return Auth0Collector.load().then(function (creds) {
                var collector = new Auth0Collector(ctx, creds);
                let fmt = collector.pawsFormatLog(auth0Mock.AUTH0_LOG_EVENT);
                assert.equal(fmt.progName, 'Auth0Collector');
                assert.ok(fmt.messageTypeId);
            });
        });
    });

    describe('pawsGetLogs', function () {

        afterEach(function () {
            if (getAPILogs && getAPILogs.restore) {
                getAPILogs.restore();
            }
        });
        let ctx = {
            invokedFunctionArn: auth0Mock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('Paws Get Logs Success', function () {
            getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(
                function fakeFn(auth0Client, state, accumulator, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return resolve({ accumulator: [auth0Mock.AUTH0_LOG_EVENT, auth0Mock.AUTH0_LOG_EVENT], nextLogId: "nextLogId", lastLogTs: null });
                    });
                });
            return Auth0Collector.load().then(function (creds) {
                var collector = new Auth0Collector(ctx, creds);
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    since: startDate.toISOString(),
                    poll_interval_sec: 1
                };

                return collector.pawsGetLogs(curState).then(([logs, newState, newPollInterval]) => {
                    assert.equal(logs.length, 2);
                    assert.equal(newState.poll_interval_sec, collector.pollInterval);
                    assert.equal(newState.last_log_id, "nextLogId");
                    assert.ok(logs[0].log_id);
                });

            });
        });
    });

    describe('Next state tests', function () {
        let ctx = {
            invokedFunctionArn: auth0Mock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('log format success', function () {
            return Auth0Collector.load().then(function (creds) {
                var collector = new Auth0Collector(ctx, creds);
                const startDate = moment();
                const curState = {
                    since: startDate.toISOString(),
                    poll_interval_sec: 1
                };
                let nextLogId = "nextLogId";
                let lastLogTs = startDate.toISOString();
                let nextState = collector._getNextCollectionState(curState, nextLogId, lastLogTs);
                assert.equal(nextState.last_log_id, 'nextLogId');
                assert.equal(nextState.last_collected_ts, lastLogTs);
                assert.equal(nextState.poll_interval_sec, collector.pollInterval);
            });
        });
        it('log format success with nextLogId null', function () {
            return Auth0Collector.load().then(function (creds) {
                var collector = new Auth0Collector(ctx, creds);
                const startDate = moment();
                const curState = {
                    since: startDate.toISOString(),
                    poll_interval_sec: 1
                };
                let nextLogId = null;
                let lastLogTs = null;
                let nextState = collector._getNextCollectionState(curState, nextLogId, lastLogTs);
                assert.ok(nextState.since);
                assert.equal(nextState.since, curState.since);
                assert.equal(nextState.poll_interval_sec, 1); 
            });
        });
        it('log format success with nextLogId null and lastLogTs is not null', function () {
            return Auth0Collector.load().then(function (creds) {
                var collector = new Auth0Collector(ctx, creds);
                const startDate = moment();
                const curState = {
                    since: startDate.toISOString(),
                    poll_interval_sec: 1
                };
                let nextLogId = null;
                let lastLogTs = startDate.toISOString();
                let nextState = collector._getNextCollectionState(curState, nextLogId, lastLogTs);
                assert.ok(nextState.since);
                assert.equal(nextState.since, lastLogTs);
                assert.equal(nextState.poll_interval_sec, 1);
            });
        });
    });


    describe('pawsGetLogs', function () {
        let ctx = {
            invokedFunctionArn: auth0Mock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        afterEach(function () {
            if (getAPILogs && getAPILogs.restore) {
                getAPILogs.restore();
            }
        });

        let errorObj ={
            statusCode:401,
            message:'error'
        };
        it('Paws Get Logs Failed', function () {
            getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(
                function fakeFn(auth0Client, state, accumulator, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return reject(errorObj);
                    });
                });
            return Auth0Collector.load().then(function (creds) {
                var collector = new Auth0Collector(ctx, creds);
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    since: startDate.toISOString(),
                    poll_interval_sec: 1
                };

                return collector.pawsGetLogs(curState).catch((err) => {
                    assert.equal(err.errorCode,401);
                });

            });
        });

        it('Paws Get Logs check throttling error', function () {
            getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(
                function fakeFn(auth0Client, state, accumulator, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return reject({statusCode:429,
                            message:'Too many requests'});
                    });
                });
            return Auth0Collector.load().then(function (creds) {
                var collector = new Auth0Collector(ctx, creds);
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    since: startDate.toISOString(),
                    poll_interval_sec: 1
                };

                var reportSpy = sinon.spy(collector, 'reportApiThrottling');
                let putMetricDataStub = sinon.stub(CloudWatch.prototype, 'putMetricData').callsFake((params) => Promise.resolve({
                    httpStatusCode: 200,
                    requestId: '12345'
                }));
                return collector.pawsGetLogs(curState).then(([logs, newState, newPollInterval]) => {
                    assert.equal(true, reportSpy.calledOnce);
                    assert.equal(logs.length, 0);
                    assert.equal(newState.poll_interval_sec, 10);
                    putMetricDataStub.restore();
                });
            });
        });
    });
});
