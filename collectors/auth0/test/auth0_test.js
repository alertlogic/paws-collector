const assert = require('assert');
const sinon = require('sinon');
const moment = require('moment');
var AWS = require('aws-sdk-mock');
const m_response = require('cfn-response');

const auth0Mock = require('./auth0_mock');
var m_alCollector = require('@alertlogic/al-collector-js');
var Auth0Collector = require('../auth0_collector').Auth0Collector;
const m_al_aws = require('@alertlogic/al-aws-collector-js').Util;
const utils = require("../utils");


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
    setEnvStub = sinon.stub(m_al_aws, 'setEnv').callsFake((vars, callback) => {
        const {
            ingest_api,
            azcollect_api
        } = vars;
        process.env.ingest_api = ingest_api ? ingest_api : process.env.ingest_api;
        process.env.azollect_api = azcollect_api ? azcollect_api : process.env.azollect_api;
        const returnBody = {
            Environment: {
                Varaibles: vars
            }
        };
        return callback(null, returnBody);
    });
}

describe('Unit Tests', function () {

    beforeEach(function () {
        AWS.mock('SSM', 'getParameter', function (params, callback) {
            const data = new Buffer('test-secret');
            return callback(null, { Parameter: { Value: data.toString('base64') } });
        });

        AWS.mock('KMS', 'decrypt', function (params, callback) {
            const data = {
                Plaintext: 'decrypted-sercret-key'
            };
            return callback(null, data);
        });

        responseStub = sinon.stub(m_response, 'send').callsFake(
            function fakeFn(event, mockContext, responseStatus, responseData, physicalResourceId) {
                mockContext.succeed();
            });

        setAlServiceStub();
        mockSetEnvStub();
    });

    afterEach(function () {
        restoreAlServiceStub();
        setEnvStub.restore();
        responseStub.restore();
        AWS.restore('KMS');
        AWS.restore('SSM');
    });

    describe('pawsInitCollectionState', function () {
        let ctx = {
            invokedFunctionArn: auth0Mock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('sets up intial state', function (done) {
            Auth0Collector.load().then(function (creds) {
                const testPollInterval = 60;
                var collector = new Auth0Collector(ctx, creds);
                const startDate = moment().subtract(1, 'days').toISOString();
                process.env.paws_collection_start_ts = startDate;
                collector.pollInterval = testPollInterval;

                collector.pawsInitCollectionState({}, (err, initialState, nextPoll) => {
                    assert.equal(initialState.since, startDate, "Dates are not equal");
                    assert.equal(initialState.poll_interval_sec, 1);
                    assert.equal(nextPoll, 1);
                    done();
                });
            });
        });
    });
    describe('Format Tests', function () {
        it('log format success', function (done) {
            let ctx = {
                invokedFunctionArn: auth0Mock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };

            Auth0Collector.load().then(function (creds) {
                var collector = new Auth0Collector(ctx, creds);
                let fmt = collector.pawsFormatLog(auth0Mock.AUTH0_LOG_EVENT);
                assert.equal(fmt.progName, 'Auth0Collector');
                assert.ok(fmt.messageTypeId);
                done();
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
        it('Paws Get Logs Success', function (done) {
            getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(
                function fakeFn(auth0Client, state, accumulator, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return resolve({ accumulator: [auth0Mock.AUTH0_LOG_EVENT, auth0Mock.AUTH0_LOG_EVENT], nextLogId: "nextLogId", lastLogTs: null });
                    });
                });
            Auth0Collector.load().then(function (creds) {
                var collector = new Auth0Collector(ctx, creds);
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    since: startDate.toISOString(),
                    poll_interval_sec: 1
                };

                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(logs.length, 2);
                    assert.equal(newState.poll_interval_sec, collector.pollInterval);
                    assert.equal(newState.last_log_id, "nextLogId");
                    assert.ok(logs[0].log_id);
                    getAPILogs.restore();
                    done();
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
        it('log format success', function (done) {
            Auth0Collector.load().then(function (creds) {
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
                done();
            });
        });
        it('log format success with nextLogId null', function (done) {
            Auth0Collector.load().then(function (creds) {
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
                assert.equal(nextState.poll_interval_sec, 1);
                done();
            });
        });
    });
});
