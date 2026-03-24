const assert = require('assert');
const sinon = require('sinon');
const m_response = require('cfn-response');
const sophosMock = require('./sophos_mock');
var SophosCollector = require('../collector').SophosCollector;
const moment = require('moment');
const utils = require("../utils");
const { CloudWatch } = require("@aws-sdk/client-cloudwatch"),
    { KMS } = require("@aws-sdk/client-kms"),
    { SSM } = require("@aws-sdk/client-ssm");

var responseStub = {};
let authenticate;
let getTenantIdAndDataRegion;
let getAPILogs;

function restoreApiStubs() {
    if (authenticate && authenticate.restore) {
        authenticate.restore();
    }
    if (getTenantIdAndDataRegion && getTenantIdAndDataRegion.restore) {
        getTenantIdAndDataRegion.restore();
    }
    if (getAPILogs && getAPILogs.restore) {
        getAPILogs.restore();
    }
}

describe('Unit Tests', function () {

    beforeEach(function () {
        sinon.stub(SSM.prototype, 'getParameter').callsFake(function () {
            const data = Buffer.from('test-secret');
            return Promise.resolve({ Parameter: { Value: data.toString('base64') } });
        });
        sinon.stub(KMS.prototype, 'decrypt').callsFake(function () {
            const data = {
                Plaintext: Buffer.from('{}')
            };
            return Promise.resolve(data);
        });

        responseStub = sinon.stub(m_response, 'send').callsFake(
            function fakeFn() {
                return Promise.resolve();
            });
    });

    afterEach(function () {
        restoreApiStubs();
        responseStub.restore();
        KMS.prototype.decrypt.restore();
        SSM.prototype.getParameter.restore();
    });

    describe('pawsInitCollectionState', function () {
        let ctx = {
            invokedFunctionArn: sophosMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };

        it('Paws Init Collection State Success', async function () {
            const creds = await SophosCollector.load();
            var collector = new SophosCollector(ctx, creds, 'sophos');
            const startDate = moment().subtract(1, 'days').toISOString();
            process.env.paws_collection_start_ts = startDate;

            const { state: initialState, nextInvocationTimeout } = await collector.pawsInitCollectionState({});
            assert.equal(initialState.since, startDate, "Dates are not equal");
            assert.equal(moment(initialState.until).diff(initialState.since, 'seconds'), 60);
            assert.equal(initialState.poll_interval_sec, 1);
            assert.equal(nextInvocationTimeout, 1);
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

        it('Paws Get Logs Success', async function () {
            authenticate = sinon.stub(utils, 'authenticate').resolves("token");
            getTenantIdAndDataRegion = sinon.stub(utils, 'getTenantIdAndDataRegion').resolves({
                "id": "57ca9a6b-885f-4e36-95ec-290548c26059",
                "idType": "tenant",
                "apiHosts": {
                    "global": "https://api.central.sophos.com",
                    "dataRegion": "https://api-us03.central.sophos.com"
                }
            });
            getAPILogs = sinon.stub(utils, 'getAPILogs').resolves({
                accumulator: [sophosMock.LOG_EVENT, sophosMock.LOG_EVENT]
            });

            const creds = await SophosCollector.load();
            var collector = new SophosCollector(ctx, creds, 'sophos');
            const startDate = moment().subtract(3, 'days');
            const curState = {
                since: startDate.toISOString(),
                until: startDate.add(2, 'days').toISOString(),
                nextPage: null,
                apiQuotaResetDate: null,
                poll_interval_sec: 1
            };

            const [logs, newState] = await collector.pawsGetLogs(curState);
            assert.equal(logs.length, 2);
            assert.equal(newState.poll_interval_sec, 1);
            assert.ok(logs[0].id);
        });

        it('Paws Get Logs with nextPage Success', async function () {
            authenticate = sinon.stub(utils, 'authenticate').resolves("token");
            getTenantIdAndDataRegion = sinon.stub(utils, 'getTenantIdAndDataRegion').resolves({
                "id": "57ca9a6b-885f-4e36-95ec-290548c26059",
                "idType": "tenant",
                "apiHosts": {
                    "global": "https://api.central.sophos.com",
                    "dataRegion": "https://api-us03.central.sophos.com"
                }
            });
            getAPILogs = sinon.stub(utils, 'getAPILogs').resolves({
                accumulator: [sophosMock.LOG_EVENT, sophosMock.LOG_EVENT],
                nextPage: "nextPage"
            });

            const creds = await SophosCollector.load();
            var collector = new SophosCollector(ctx, creds, 'sophos');
            const startDate = moment().subtract(3, 'days');
            const curState = {
                since: startDate.toISOString(),
                until: startDate.add(2, 'days').toISOString(),
                nextPage: null,
                apiQuotaResetDate: null,
                poll_interval_sec: 1
            };

            const [logs, newState] = await collector.pawsGetLogs(curState);
            assert.equal(logs.length, 2);
            assert.equal(newState.poll_interval_sec, 1);
            assert.equal(newState.nextPage, 'nextPage');
            assert.ok(logs[0].id);
        });

        it('Paws Get Logs testing credentials type error', async function () {
            authenticate = sinon.stub(utils, 'authenticate').resolves("token");
            getTenantIdAndDataRegion = sinon.stub(utils, 'getTenantIdAndDataRegion').resolves({
                "id": "57ca9a6b-885f-4e36-95ec-290548c26059",
                "idType": "ORG",
                "apiHosts": {
                    "global": "https://api.central.sophos.com"
                }
            });
            getAPILogs = sinon.stub(utils, 'getAPILogs').resolves({
                accumulator: [sophosMock.LOG_EVENT, sophosMock.LOG_EVENT]
            });

            const creds = await SophosCollector.load();
            var collector = new SophosCollector(ctx, creds, 'sophos');
            const startDate = moment().subtract(3, 'days');
            const curState = {
                since: startDate.toISOString(),
                until: startDate.add(2, 'days').toISOString(),
                nextPage: null,
                apiQuotaResetDate: null,
                poll_interval_sec: 1
            };

            await assert.rejects(
                async () => collector.pawsGetLogs(curState),
                (err) => {
                    assert.equal(err.message, "Please generate credentials for the tenant. Currently we do not support credentials for Organization and Partner.");
                    return true;
                }
            );
        });

        it('Paws Get Logs checking invalid client secret error', async function () {
            authenticate = sinon.stub(utils, 'authenticate').rejects({
                response: {
                    status: 400,
                    data: {
                        "errorCode": "customer.validation",
                        "message": "Bad Request"
                    }
                }
            });

            const creds = await SophosCollector.load();
            var collector = new SophosCollector(ctx, creds, 'sophos');
            const startDate = moment().subtract(3, 'days');
            const curState = {
                since: startDate.toISOString(),
                until: startDate.add(2, 'days').toISOString(),
                nextPage: null,
                apiQuotaResetDate: null,
                poll_interval_sec: 1
            };

            await assert.rejects(
                async () => collector.pawsGetLogs(curState),
                (err) => {
                    assert.equal(err.message, "Error code [400]. Invalid client secret is provided.");
                    return true;
                }
            );
        });

        it('Paws Get Logs checking invalid client ID error', async function () {
            authenticate = sinon.stub(utils, 'authenticate').rejects({
                response: {
                    "status": 401,
                    "data": {
                        "errorCode": "oauth.client_app_does_not_exist",
                        message: "Unauthorized"
                    }
                }
            });

            const creds = await SophosCollector.load();
            var collector = new SophosCollector(ctx, creds, 'sophos');
            const startDate = moment().subtract(3, 'days');
            const curState = {
                since: startDate.toISOString(),
                until: startDate.add(2, 'days').toISOString(),
                nextPage: null,
                apiQuotaResetDate: null,
                poll_interval_sec: 1
            };

            await assert.rejects(
                async () => collector.pawsGetLogs(curState),
                (err) => {
                    assert.equal(err.message, "Error code [401]. Invalid client ID is provided.");
                    return true;
                }
            );
        });

        it('Paws Get Logs testing throttling error', async function () {
            authenticate = sinon.stub(utils, 'authenticate').resolves("token");
            getTenantIdAndDataRegion = sinon.stub(utils, 'getTenantIdAndDataRegion').resolves({
                "id": "57ca9a6b-885f-4e36-95ec-290548c26059",
                "idType": "tenant",
                "apiHosts": {
                    "global": "https://api.central.sophos.com",
                    "dataRegion": "https://api-us03.central.sophos.com"
                }
            });
            getAPILogs = sinon.stub(utils, 'getAPILogs').rejects({
                response: { status: 429, data: { errorCode: "TooManyRequests" } }
            });

            const creds = await SophosCollector.load();
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
            let putMetricDataStub = sinon.stub(CloudWatch.prototype, 'putMetricData').callsFake(() => Promise.resolve());
            try {
                const [logs, newState] = await collector.pawsGetLogs(curState);
                assert.equal(true, reportSpy.calledOnce);
                assert.ok(newState.apiQuotaResetDate);
                assert.notEqual(newState.apiQuotaResetDate, null);
                assert.equal(logs.length, 0);
                assert.equal(newState.poll_interval_sec, 900);
            } finally {
                putMetricDataStub.restore();
            }
        });

        it('Paws Get Logs with API Quota Reset Date', async function () {
            const creds = await SophosCollector.load();
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
            let putMetricDataStub = sinon.stub(CloudWatch.prototype, 'putMetricData').callsFake(() => Promise.resolve());
            try {
                const [logs, newState] = await collector.pawsGetLogs(curState);
                assert.equal(true, reportSpy.calledOnce);
                assert.equal(logs.length, 0);
                assert.equal(newState.poll_interval_sec, 900);
            } finally {
                putMetricDataStub.restore();
            }
        });

        it('Paws Get Logs check client error', async function () {
            authenticate = sinon.stub(utils, 'authenticate').resolves("token");
            getTenantIdAndDataRegion = sinon.stub(utils, 'getTenantIdAndDataRegion').rejects({
                response: {
                    data: {
                        errorCode: "Unauthorized",
                        code: "USR00004c5",
                        message: "The client needs to authenticate before making the API call. Either your credentials are invalid or blacklisted, or your JWT authorization token has expired",
                        requestId: "6DB1D8AC-1BFA-448B-8439-5486E6D25A74"
                    }
                }
            });

            const creds = await SophosCollector.load();
            var collector = new SophosCollector(ctx, creds, 'sophos');
            const startDate = moment().subtract(3, 'days');
            const curState = {
                since: startDate.toISOString(),
                until: startDate.add(2, 'days').toISOString(),
                nextPage: null,
                apiQuotaResetDate: null,
                poll_interval_sec: 1
            };

            await assert.rejects(
                async () => collector.pawsGetLogs(curState),
                (err) => {
                    assert.equal(err.errorCode, 'Unauthorized');
                    return true;
                }
            );
        });
    });

    describe('Next state tests', function () {
        it('log format success', async function () {
            let ctx = {
                invokedFunctionArn: sophosMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                },
                succeed: function () {}
            };

            const creds = await SophosCollector.load();
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
            assert.equal(nextState.poll_interval_sec, process.env.paws_poll_interval_delay);
        });
    });

    describe('Format Tests', function () {
        it('log format success', async function () {
            let ctx = {
                invokedFunctionArn: sophosMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                },
                succeed: function () {}
            };

            const creds = await SophosCollector.load();
            var collector = new SophosCollector(ctx, creds, 'sophos');
            let fmt = collector.pawsFormatLog(sophosMock.LOG_EVENT);
            assert.equal(fmt.progName, 'SophosCollector');
            assert.ok(fmt.message);
        });
    });

    describe('NextCollectionStateWithNextPage', function () {
        it('Get Next Collection State With NextPage Success', async function () {
            let ctx = {
                invokedFunctionArn: sophosMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                },
                succeed: function () {}
            };

            const startDate = moment().subtract(5, 'minutes');
            const curState = {
                since: startDate.toISOString(),
                until: startDate.add(5, 'minutes').toISOString(),
                poll_interval_sec: 1
            };
            const nextPage = "nextKey";

            const creds = await SophosCollector.load();
            var collector = new SophosCollector(ctx, creds, 'sophos');
            let nextState = collector._getNextCollectionStateWithNextPage(curState, nextPage);
            assert.ok(nextState.nextPage);
            assert.equal(nextState.nextPage, nextPage);
        });
    });

});
