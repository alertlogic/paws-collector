const assert = require('assert');
const sinon = require('sinon');
const m_response = require('@alertlogic/al-aws-collector-js').CfnResponse;
const sentineloneMock = require('./sentinelone_mock');  
var SentineloneCollector = require('../collector').SentineloneCollector;
const moment = require('moment');
const utils = require("../utils");
const { KMS } = require("@aws-sdk/client-kms"),
    { SSM } = require("@aws-sdk/client-ssm");

var responseStub = {};
let getAPILogs;

function restoreApiLogsStub() {
    if (getAPILogs && getAPILogs.restore) {
        getAPILogs.restore();
    }
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
    });

    afterEach(function () {
        restoreApiLogsStub();
        responseStub.restore();
        KMS.prototype.decrypt.restore();
        SSM.prototype.getParameter.restore();
    });

    describe('Paws Init Collection State', function () {
        let ctx = {
            invokedFunctionArn: sentineloneMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };

        it('Paws Init Collection State Success', async function () {
            const creds = await SentineloneCollector.load();
            var collector = new SentineloneCollector(ctx, creds, 'sentinelone');
            const startDate = moment().subtract(1, 'days').toISOString();
            process.env.paws_collection_start_ts = startDate;

            const { state: initialState } = await collector.pawsInitCollectionState(null);
            assert.equal(moment(initialState.until).diff(initialState.since, 'seconds'), 60);
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

        it('Paws Get Logs Success', async function () {
            getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(
                function fakeFn(baseUrl, token, params, accumulator, paws_max_pages_per_invocation) {
                    return Promise.resolve({ accumulator: [sentineloneMock.LOG_EVENT, sentineloneMock.LOG_EVENT] });
                });

            const creds = await SentineloneCollector.load();
            var collector = new SentineloneCollector(ctx, creds, 'sentinelone');
            const startDate = moment().subtract(3, 'days');
            const curState = {
                since: startDate.toISOString(),
                until: startDate.add(2, 'days').toISOString(),
                nextPage: null,
                poll_interval_sec: 1
            };

            const [logs, newState] = await collector.pawsGetLogs(curState);
            assert.equal(logs.length, 2);
            assert.equal(newState.poll_interval_sec, 1);
            assert.ok(logs[0].id);
        });

        it('Paws Get Logs with nextPage Success', async function () {
            getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(
                function fakeFn(baseUrl, token, params, accumulator, paws_max_pages_per_invocation) {
                    return Promise.resolve({ accumulator: [sentineloneMock.LOG_EVENT, sentineloneMock.LOG_EVENT], nextPage: "nextPage" });
                });

            const creds = await SentineloneCollector.load();
            var collector = new SentineloneCollector(ctx, creds, 'sentinelone');
            const startDate = moment().subtract(3, 'days');
            const curState = {
                since: startDate.toISOString(),
                until: startDate.add(2, 'days').toISOString(),
                nextPage: null,
                poll_interval_sec: 1
            };

            const [logs, newState] = await collector.pawsGetLogs(curState);
            assert.equal(logs.length, 2);
            assert.equal(newState.poll_interval_sec, 1);
            assert.ok(logs[0].id);
            assert.equal(newState.nextPage, 'nextPage');
        });

        it('Paws Get Logs failed and show client errors', async function () {
            getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(
                function fakeFn(baseUrl, token, params, accumulator, paws_max_pages_per_invocation) {
                    return Promise.reject({
                        response: {
                            status: 401,
                            data: { errors: [{ code: 4010010, detail: null, title: 'Authentication Failed' }] }
                        }
                    });
                });

            const creds = await SentineloneCollector.load();
            var collector = new SentineloneCollector(ctx, creds, 'sentinelone');
            const startDate = moment().subtract(3, 'days');
            const curState = {
                since: startDate.toISOString(),
                until: startDate.add(2, 'days').toISOString(),
                nextPage: null,
                poll_interval_sec: 1
            };

            await assert.rejects(
                async () => collector.pawsGetLogs(curState),
                (err) => {
                    assert.equal(err.errorCode, 4010010);
                    return true;
                }
            );
        });

        it('Paws Get Logs maps status-only errors', async function () {
            getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(
                function fakeFn(baseUrl, token, params, accumulator, paws_max_pages_per_invocation) {
                    return Promise.reject({
                        response: {
                            status: 401
                        }
                    });
                });

            const creds = await SentineloneCollector.load();
            var collector = new SentineloneCollector(ctx, creds, 'sentinelone');
            const startDate = moment().subtract(3, 'days');
            const curState = {
                since: startDate.toISOString(),
                until: startDate.add(2, 'days').toISOString(),
                nextPage: null,
                poll_interval_sec: 1
            };

            await assert.rejects(
                async () => collector.pawsGetLogs(curState),
                (err) => {
                    assert.equal(err.errorCode, 401);
                    return true;
                }
            );
        });
    });

    describe('Next state tests', function () {
        it('log format success', async function () {
            let ctx = {
                invokedFunctionArn: sentineloneMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                },
                succeed: function () {}
            };

            const creds = await SentineloneCollector.load();
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
        });
    });

    describe('Format Tests', function () {
        it('log format success', async function () {
            let ctx = {
                invokedFunctionArn: sentineloneMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                },
                succeed: function () {}
            };

            const creds = await SentineloneCollector.load();
            var collector = new SentineloneCollector(ctx, creds, 'sentinelone');
            let fmt = collector.pawsFormatLog(sentineloneMock.LOG_EVENT);
            assert.equal(fmt.progName, 'SentineloneCollector');
            assert.ok(fmt.message);
        });
    });

    describe('NextCollectionStateWithNextPage', function () {
        it('Get Next Collection State With NextPage Success', async function () {
            let ctx = {
                invokedFunctionArn: sentineloneMock.FUNCTION_ARN,
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
            const nextPage = "cursor";
            const creds = await SentineloneCollector.load();
            var collector = new SentineloneCollector(ctx, creds, 'sentinelone');
            let nextState = collector._getNextCollectionStateWithNextPage(curState, nextPage);
            assert.ok(nextState.nextPage);
            assert.equal(nextState.nextPage, nextPage);
        });
    });
});
