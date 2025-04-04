const assert = require('assert');
const sinon = require('sinon');
const m_response = require('cfn-response');
const sophossiemMock = require('./sophossiem_mock');
var SophossiemCollector = require('../collector').SophossiemCollector;
const moment = require('moment');
const utils = require("../utils");
const { CloudWatch } = require("@aws-sdk/client-cloudwatch"),
    { KMS } = require("@aws-sdk/client-kms"),
    { SSM } = require("@aws-sdk/client-ssm");

var responseStub = {};
let authenticate, getTenantIdAndDataRegion, getAPILogs;
describe('Unit Tests', function () {

    beforeEach(function () {
        sinon.stub(SSM.prototype, 'getParameter').callsFake(function (params, callback) {
            const data = Buffer.from('test-secret');
            return callback(null, { Parameter: { Value: data.toString('base64') } });
        });
        sinon.stub(KMS.prototype, 'decrypt').callsFake(function (params, callback) {
            const data = {
                Plaintext: Buffer.from('{}')
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
        KMS.prototype.decrypt.restore();
        SSM.prototype.getParameter.restore();
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
                        assert(moment().diff(moment(moment.unix(parseInt(state.from_date)).format("YYYY-MM-DDTHH:mm:ssZ")), 'hours') < 24 ,"From date must be within last 24 hours");
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
                        assert(moment().diff(moment(moment.unix(parseInt(state.from_date)).format("YYYY-MM-DDTHH:mm:ssZ")), 'hours') < 24 ,"From date must be within last 24 hours");     
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
                        sophosSiemObjectNames: "[\"Events\", \"Alerts\"]",
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
                function fakeFn(BaseAPIURL, headers, state, accumulator, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return resolve({ accumulator: [sophossiemMock.LOG_EVENT, sophossiemMock.LOG_EVENT], nextPage: "nextPage", has_more: false });
                    });
                });

            SophossiemCollector.load().then(function (creds) {
                var collector = new SophossiemCollector(ctx, creds, 'sophossiem');
                const startDate = moment().subtract(23, 'hours');
                const curState = {
                    stream: "Events",
                    from_date: startDate.unix(),
                    poll_interval_sec: 1
                };
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(logs.length, 2);
                    assert.equal(newState.poll_interval_sec, 60);
                    assert.equal(newState.nextPage, "nextPage");
                    assert.ok(logs[0].id);
                    getAPILogs.restore();
                    getTenantIdAndDataRegion.restore();
                    authenticate.restore();
                    done();
                });

            });
        });

        it('Paws Get Logs with has more true Success', function (done) {
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
                function fakeFn(BaseAPIURL, headers, state, accumulator, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return resolve({ accumulator: [sophossiemMock.LOG_EVENT, sophossiemMock.LOG_EVENT], nextPage: "nextPage", has_more: true });
                    });
                });

            SophossiemCollector.load().then(function (creds) {
                var collector = new SophossiemCollector(ctx, creds, 'sophossiem');
                const curState = {
                    stream: "Events",
                    nextPage: "nextPage",
                    poll_interval_sec: 1
                };
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(logs.length, 2);
                    assert.equal(newState.poll_interval_sec, 1);
                    assert.equal(newState.nextPage, "nextPage");
                    assert.ok(logs[0].id);
                    getAPILogs.restore();
                    getTenantIdAndDataRegion.restore();
                    authenticate.restore();
                    done();
                });

            });
        });

        it('Get Logs check API throttling error', function (done) {

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
                        return reject({ response: { status: 429, data: { errorCode: "TooManyRequests" } } });
                    });
                });

            SophossiemCollector.load().then(function (creds) {
                var collector = new SophossiemCollector(ctx, creds, 'sophossiem');
                const startDate = moment().subtract(23, 'hours');
                const curState = {
                    stream: "Events",
                    from_date: startDate.unix(),
                    poll_interval_sec: 1
                };

                var reportSpy = sinon.spy(collector, 'reportApiThrottling');
                let putMetricDataStub = sinon.stub(CloudWatch.prototype, 'putMetricData').callsFake((params, callback) => callback(null));
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(true, reportSpy.calledOnce);
                    assert.equal(logs.length, 0);
                    assert.equal(newState.poll_interval_sec, 900);
                    getAPILogs.restore();
                    putMetricDataStub.restore();
                    getTenantIdAndDataRegion.restore();
                    authenticate.restore();
                    done();
                });

            });
        });

        it('Paws Get Logs api Failed and show client error on DDMetric', function (done) {
            authenticate = sinon.stub(utils, 'authenticate').callsFake(
                function fakeFn(hostName, clientId, clientSecret) {
                    return new Promise(function (resolve, reject) {
                        return resolve("token");
                    });
                });
            getTenantIdAndDataRegion = sinon.stub(utils, 'getTenantIdAndDataRegion').callsFake(
                function fakeFn(hostName, token) {
                    return new Promise(function (resolve, reject) {
                        return reject({ response: { data: { errorCode: "Unauthorized", code: "USR00004c5", message: "The client needs to authenticate before making the API call. Either your credentials are invalid or blacklisted, or your JWT authorization token has expired", requestId: "6DB1D8AC-1BFA-448B-8439-5486E6D25A74" } } });
                    });
                });

            getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(
                function fakeFn(BaseAPIURL, headers, state, accumulator, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return reject({
                            response: {
                                status: 403,
                                data: {
                                    error: "Forbidden",
                                    message: "Forbidden",
                                    correlationId: "59763C8E-B687-47D0-8F7B-88113425CE3B",
                                    code: "USR00004c5",
                                    createdAt: "2019-08-15T11:25:45.987Z"
                                }
                            }
                        });
                    });
                });

            SophossiemCollector.load().then(function (creds) {
                var collector = new SophossiemCollector(ctx, creds, 'sophossiem');
                const startDate = moment().subtract(23, 'hours');
                const curState = {
                    stream: "Events",
                    from_date: startDate.unix(),
                    poll_interval_sec: 1
                };
                collector.pawsGetLogs(curState, (err) => {
                    assert.equal(err.errorCode,"Unauthorized");
                    getAPILogs.restore();
                    getTenantIdAndDataRegion.restore();
                    authenticate.restore();
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
                    stream: "Events",
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
                    stream: "Events",
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
