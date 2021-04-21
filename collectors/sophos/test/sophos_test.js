const assert = require('assert');
const sinon = require('sinon');
var AWS = require('aws-sdk-mock');
const m_response = require('cfn-response');
const sophosMock = require('./sophos_mock');
var SophosCollector = require('../collector').SophosCollector;
const moment = require('moment');
const utils = require("../utils");

var responseStub = {};
let authenticate, getTenantIdAndDataRegion, getAPILogs;

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
            invokedFunctionArn: sophosMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('Paws Init Collection State Success', function (done) {
            SophosCollector.load().then(function (creds) {
                var collector = new SophosCollector(ctx, creds, 'sophos');
                const startDate = moment().subtract(1, 'days').toISOString();
                process.env.paws_collection_start_ts = startDate;

                collector.pawsInitCollectionState({}, (err, initialState, nextPoll) => {
                    assert.equal(initialState.since, startDate, "Dates are not equal");
                    assert.equal(moment(initialState.until).diff(initialState.since, 'seconds'), 60);
                    assert.equal(initialState.poll_interval_sec, 1);
                    assert.equal(nextPoll, 1);
                    done();
                });
            });
        });
    });

    describe('pawsGetLogs', function () {
        let ctx = {
            invokedFunctionArn: sophosMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('Paws Get Logs Success', function (done) {
            authenticate = sinon.stub(utils, 'authenticate').callsFake(
                function fakeFn(hostName, clientId, clientSecret) {
                    return new Promise(function (resolve, reject) {
                        return resolve("token");
                    });
                });
            getTenantIdAndDataRegion = sinon.stub(utils, 'getTenantIdAndDataRegion').callsFake(
                function fakeFn(hostName, token) {
                    return new Promise(function (resolve, reject) {
                        return resolve({
                            "id": "57ca9a6b-885f-4e36-95ec-290548c26059",
                            "idType": "tenant",
                            "apiHosts": {
                                "global": "https://api.central.sophos.com",
                                "dataRegion": "https://api-us03.central.sophos.com"
                            }
                        });
                    });
                });
            getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(
                function fakeFn(baseUrl, token, tenant_Id, state, accumulator, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return resolve({ accumulator: [sophosMock.LOG_EVENT, sophosMock.LOG_EVENT] });
                    });
                });
            SophosCollector.load().then(function (creds) {
                var collector = new SophosCollector(ctx, creds, 'sophos');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    nextPage: null,
                    apiQuotaResetDate: null,
                    poll_interval_sec: 1
                };
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(logs.length, 2);
                    assert.equal(newState.poll_interval_sec, 1);
                    assert.ok(logs[0].id);
                    getAPILogs.restore();
                    getTenantIdAndDataRegion.restore();
                    authenticate.restore();
                    done();
                });

            });
        });

        it('Paws Get Logs with nextPage Success', function (done) {
            authenticate = sinon.stub(utils, 'authenticate').callsFake(
                function fakeFn(hostName, clientId, clientSecret) {
                    return new Promise(function (resolve, reject) {
                        return resolve("token");
                    });
                });
            getTenantIdAndDataRegion = sinon.stub(utils, 'getTenantIdAndDataRegion').callsFake(
                function fakeFn(hostName, token) {
                    return new Promise(function (resolve, reject) {
                        return resolve({
                            "id": "57ca9a6b-885f-4e36-95ec-290548c26059",
                            "idType": "tenant",
                            "apiHosts": {
                                "global": "https://api.central.sophos.com",
                                "dataRegion": "https://api-us03.central.sophos.com"
                            }
                        });
                    });
                });
            getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(
                function fakeFn(baseUrl, token, tenant_Id, state, accumulator, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return resolve({ accumulator: [sophosMock.LOG_EVENT, sophosMock.LOG_EVENT], nextPage: "nextPage" });
                    });
                });
            SophosCollector.load().then(function (creds) {
                var collector = new SophosCollector(ctx, creds, 'sophos');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    nextPage: null,
                    apiQuotaResetDate: null,
                    poll_interval_sec: 1
                };
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(logs.length, 2);
                    assert.equal(newState.poll_interval_sec, 1);
                    assert.ok(logs[0].id);
                    getAPILogs.restore();
                    getTenantIdAndDataRegion.restore();
                    authenticate.restore();
                    done();
                });

            });
        });

        it('Paws Get Logs testing credentials type error', function (done) {
            authenticate = sinon.stub(utils, 'authenticate').callsFake(
                function fakeFn(hostName, clientId, clientSecret) {
                    return new Promise(function (resolve, reject) {
                        return resolve("token");
                    });
                });
            getTenantIdAndDataRegion = sinon.stub(utils, 'getTenantIdAndDataRegion').callsFake(
                function fakeFn(hostName, token) {
                    return new Promise(function (resolve, reject) {
                        return resolve({
                            "id": "57ca9a6b-885f-4e36-95ec-290548c26059",
                            "idType": "ORG",
                            "apiHosts": {
                                "global": "https://api.central.sophos.com",
                            }
                        });
                    });
                });
            getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(
                function fakeFn(baseUrl, token, tenant_Id, state, accumulator, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return resolve({ accumulator: [sophosMock.LOG_EVENT, sophosMock.LOG_EVENT] });
                    });
                });
            SophosCollector.load().then(function (creds) {
                var collector = new SophosCollector(ctx, creds, 'sophos');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    nextPage: null,
                    apiQuotaResetDate: null,
                    poll_interval_sec: 1
                };
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.ok(err);
                    assert.equal(err,"Please generate credentials for the tenant. Currently we do not support credentials for Organization and Partner.");
                    getAPILogs.restore();
                    getTenantIdAndDataRegion.restore();
                    authenticate.restore();
                    done();
                });

            });
        });

        it('Paws Get Logs checking invalid client secret error', function (done) {
            authenticate = sinon.stub(utils, 'authenticate').callsFake(
                function fakeFn(hostName, clientId, clientSecret) {
                    return new Promise(function (resolve, reject) {
                        return reject({ "statusCode": 401, "message": `{ "errorCode": "oauth.invalid_client_secret" }` });
                    });
                });
           
            SophosCollector.load().then(function (creds) {
                var collector = new SophosCollector(ctx, creds, 'sophos');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    nextPage: null,
                    apiQuotaResetDate: null,
                    poll_interval_sec: 1
                };
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.ok(err);
                    assert.equal(err,"Error code [401]. Invalid client secret is provided.");
                    authenticate.restore();
                    done();
                });

            });
        });

        it('Paws Get Logs checking invalid client ID error', function (done) {
            authenticate = sinon.stub(utils, 'authenticate').callsFake(
                function fakeFn(hostName, clientId, clientSecret) {
                    return new Promise(function (resolve, reject) {
                        return reject({ "statusCode": 401, "message": `{ "errorCode": "oauth.client_app_does_not_exist" }` });
                    });
                });
           
            SophosCollector.load().then(function (creds) {
                var collector = new SophosCollector(ctx, creds, 'sophos');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    nextPage: null,
                    apiQuotaResetDate: null,
                    poll_interval_sec: 1
                };
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.ok(err);
                    assert.equal(err,"Error code [401]. Invalid client ID is provided.");
                    authenticate.restore();
                    done();
                });

            });
        });

        it('Paws Get Logs testing throttling error', function (done) {
            authenticate = sinon.stub(utils, 'authenticate').callsFake(
                function fakeFn(hostName, clientId, clientSecret) {
                    return new Promise(function (resolve, reject) {
                        return resolve("token");
                    });
                });
            getTenantIdAndDataRegion = sinon.stub(utils, 'getTenantIdAndDataRegion').callsFake(
                function fakeFn(hostName, token) {
                    return new Promise(function (resolve, reject) {
                        return resolve({
                            "id": "57ca9a6b-885f-4e36-95ec-290548c26059",
                            "idType": "tenant",
                            "apiHosts": {
                                "global": "https://api.central.sophos.com",
                                "dataRegion": "https://api-us03.central.sophos.com"
                            }
                        });
                    });
                });
            getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(
                function fakeFn(baseUrl, token, tenant_Id, state, accumulator, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return reject({ error: {error:"TooManyRequests"} });
                    });
                });
            SophosCollector.load().then(function (creds) {
                var collector = new SophosCollector(ctx, creds, 'sophos');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    nextPage: null,
                    apiQuotaResetDate: null,
                    poll_interval_sec: 1
                };

                var reportSpy = sinon.spy(collector, 'reportApiThrottling');

                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(true, reportSpy.calledOnce);
                    assert.ok(newState.apiQuotaResetDate);
                    assert.notEqual(newState.apiQuotaResetDate,null);
                    assert.equal(logs.length, 0);
                    assert.equal(newState.poll_interval_sec, 900);           
                    getAPILogs.restore();
                    getTenantIdAndDataRegion.restore();
                    authenticate.restore();
                    done();
                });

            });
        });

        it('Paws Get Logs with API Quota Reset Date', function (done) {
            SophosCollector.load().then(function (creds) {
                var collector = new SophosCollector(ctx, creds, 'sophos');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    nextPage: null,
                    apiQuotaResetDate: moment().add(1, 'hours').toISOString(),
                    poll_interval_sec: 900
                };

                var reportSpy = sinon.spy(collector, 'reportApiThrottling');

                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(true, reportSpy.calledOnce);
                    assert.equal(logs.length, 0);
                    assert.equal(newState.poll_interval_sec, 900);
                    done();
                });

            });
        });

        it('Paws Get Logs check client error', function (done) {
            authenticate = sinon.stub(utils, 'authenticate').callsFake(
                function fakeFn(hostName, clientId, clientSecret) {
                    return new Promise(function (resolve, reject) {
                        return resolve("token");
                    });
                });
            getTenantIdAndDataRegion = sinon.stub(utils, 'getTenantIdAndDataRegion').callsFake(
                function fakeFn(hostName, token) {
                    return new Promise(function (resolve, reject) {
                        return reject({ error: {error:"Unauthorized",code: "USR00004c5",message: "The client needs to authenticate before making the API call. Either your credentials are invalid or blacklisted, or your JWT authorization token has expired",requestId: "6DB1D8AC-1BFA-448B-8439-5486E6D25A74"} });
                    });
                });
           
            SophosCollector.load().then(function (creds) {
                var collector = new SophosCollector(ctx, creds, 'sophos');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    nextPage: null,
                    apiQuotaResetDate: null,
                    poll_interval_sec: 1
                };


                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(err.errorCode , 'Unauthorized');
                    getTenantIdAndDataRegion.restore();
                    authenticate.restore();
                    done();
                });

            });
        });
    });

    describe('Next state tests', function () {
        it('log format success', function (done) {
            let ctx = {
                invokedFunctionArn: sophosMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };

            SophosCollector.load().then(function (creds) {
                var collector = new SophosCollector(ctx, creds, 'sophos');
                const startDate = moment();
                const curState = {
                    since: startDate.toISOString(),
                    until: startDate.add(collector.pollInterval, 'seconds').toISOString(),
                    nextPage: null,
                    apiQuotaResetDate: null,
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
            let ctx = {
                invokedFunctionArn: sophosMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };

            SophosCollector.load().then(function (creds) {
                var collector = new SophosCollector(ctx, creds, 'sophos');
                let fmt = collector.pawsFormatLog(sophosMock.LOG_EVENT);
                assert.equal(fmt.progName, 'SophosCollector');
                assert.ok(fmt.message);
                done();
            });
        });
    });

    describe('NextCollectionStateWithNextPage', function () {
        it('Get Next Collection State With NextPage Success', function (done) {
            let ctx = {
                invokedFunctionArn: sophosMock.FUNCTION_ARN,
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
            const nextPage = "nextKey";
            SophosCollector.load().then(function (creds) {
                var collector = new SophosCollector(ctx, creds, 'sophos');
                let nextState = collector._getNextCollectionStateWithNextPage(curState, nextPage);
                assert.ok(nextState.nextPage);
                assert.equal(nextState.nextPage, nextPage);
                done();
            });
        });
    });

});
