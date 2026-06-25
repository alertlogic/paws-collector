const assert = require('assert');
const sinon = require('sinon');
const m_response = require('@alertlogic/al-aws-collector-js').CfnResponse;
const ciscoduoMock = require('./ciscoduo_mock');
var CiscoduoCollector = require('../collector').CiscoduoCollector;
const moment = require('moment');
const utils = require("../utils");
const { CloudWatch } = require("@aws-sdk/client-cloudwatch"),
    { KMS } = require("@aws-sdk/client-kms"),
    { SSM } = require("@aws-sdk/client-ssm");


var responseStub = {};
let getAPIDetails;
let getAPILogs;

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
        responseStub.restore();
        KMS.prototype.decrypt.restore();
        SSM.prototype.getParameter.restore();
    });


    describe('Paws Init Collection State', function () {
        let ctx = {
            invokedFunctionArn: ciscoduoMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('Paws Init Collection State Success', async function () {
            const creds = await CiscoduoCollector.load();
            var collector = new CiscoduoCollector(ctx, creds, 'ciscoduo');
            const startDate = moment().subtract(1, 'days').toISOString();
            process.env.paws_collection_start_ts = startDate;

            const { state } = await collector.pawsInitCollectionState();
            // All streams now use 13-digit ms timestamps
            state.forEach((initialState) => {
                assert.ok(initialState.since > 1e12, `since should be ms for stream ${initialState.stream}`);
                assert.ok(initialState.until > 1e12, `until should be ms for stream ${initialState.stream}`);
                assert.ok(initialState.until > initialState.since);
                assert.strictEqual(initialState.nextPage, null);
                assert.ok(initialState.poll_interval_sec > 0);
            });
        });
    });

    describe('Paws Get Register Parameters', function () {
        it('Paws Get Register Parameters Success', async function () {
            let ctx = {
                invokedFunctionArn: ciscoduoMock.FUNCTION_ARN,
                fail: function (error) { },
                succeed: function () { }
            };

            const creds = await CiscoduoCollector.load();
            var collector = new CiscoduoCollector(ctx, creds, 'ciscoduo');
            const sampleEvent = { ResourceProperties: { StackName: 'a-stack-name' } };
            const regValues = await collector.pawsGetRegisterParameters(sampleEvent);
            const expectedRegValues = {
                ciscoduoObjectNames: '[\"Authentication\", \"Administrator\",\"Telephony\", \"OfflineEnrollment\"]',
            };
            assert.deepEqual(regValues, expectedRegValues);
        });
    });

    describe('pawsGetLogs', function () {
        let ctx = {
            invokedFunctionArn: ciscoduoMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('Paws Get Logs Success', async function () {
            getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(
                function fakeFn(client, objectDetails, state, accumulator, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return resolve({ accumulator: [ciscoduoMock.LOG_EVENT, ciscoduoMock.LOG_EVENT] });
                    });
                });
            getAPIDetails = sinon.stub(utils, 'getAPIDetails').callsFake(
                function fakeFn(state) {
                    const startDate = moment().subtract(3, 'days');
                    return {
                        url: "api_url",
                        typeIdPaths: [{ path: ["txid"] }],
                        tsPaths: [{ path: ["timestamp"] }],
                        query: {
                            mintime: startDate.valueOf(),
                            maxtime: startDate.add(2, 'days').valueOf(),
                            limit: 1000
                        },
                        method: "GET"
                    };
                });
            const creds = await CiscoduoCollector.load();
            var collector = new CiscoduoCollector(ctx, creds, 'ciscoduo');
            const startDate = moment().subtract(3, 'days');
            const curState = {
                stream: "Authentication",
                since: startDate.valueOf(),
                until: startDate.add(2, 'days').valueOf(),
                nextPage: null,
                poll_interval_sec: 1
            };
            const [logs, newState] = await collector.pawsGetLogs(curState);
            assert.equal(logs.length, 2);
            assert.equal(newState.poll_interval_sec, 60);
            assert.ok(logs[0].txid);
            getAPILogs.restore();
            getAPIDetails.restore();

        });

        it('Paws Get Logs With NextPage Success', async function () {
            getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(
                function fakeFn(client, objectDetails, state, accumulator, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return resolve({ accumulator: [ciscoduoMock.LOG_EVENT, ciscoduoMock.LOG_EVENT], nextPage: "nextPage" });
                    });
                });
            getAPIDetails = sinon.stub(utils, 'getAPIDetails').callsFake(
                function fakeFn(state) {
                    const startDate = moment().subtract(3, 'days');
                    return {
                        url: "api_url",
                        typeIdPaths: [{ path: ["txid"] }],
                        tsPaths: [{ path: ["timestamp"] }],
                        query: {
                            mintime: startDate.valueOf(),
                            maxtime: startDate.add(2, 'days').valueOf(),
                            limit: 1000
                        },
                        method: "GET"
                    };
                });
            const creds = await CiscoduoCollector.load();
            var collector = new CiscoduoCollector(ctx, creds, 'ciscoduo');
            const startDate = moment().subtract(3, 'days');
            const curState = {
                stream: "Authentication",
                since: startDate.valueOf(),
                until: startDate.add(2, 'days').valueOf(),
                nextPage: null,
                poll_interval_sec: 1
            };
            const [logs, newState] = await collector.pawsGetLogs(curState);
            assert.equal(logs.length, 2);
            assert.equal(newState.poll_interval_sec, 60);
            assert.equal(newState.nextPage, "nextPage");
            assert.ok(logs[0].txid);
            getAPILogs.restore();
            getAPIDetails.restore();
        });

        it('Paws Get client error', async function () {

            getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(
                function fakeFn(client, objectDetails, state, accumulator, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return reject({
                            code: 40103,
                            message: 'Invalid signature in request credentials',
                            stat: 'FAIL'
                        });
                    });
                });
            getAPIDetails = sinon.stub(utils, 'getAPIDetails').callsFake(
                function fakeFn(state) {
                    const startDate = moment().subtract(3, 'days');
                    return {
                        url: "api_url",
                        typeIdPaths: [{ path: ["txid"] }],
                        tsPaths: [{ path: ["timestamp"] }],
                        query: {
                            mintime: startDate.valueOf(),
                            maxtime: startDate.add(2, 'days').valueOf(),
                            limit: 1000
                        },
                        method: "GET"
                    };
                });
            const creds = await CiscoduoCollector.load();
            var collector = new CiscoduoCollector(ctx, creds, 'ciscoduo');
            const startDate = moment().subtract(3, 'days');
            const curState = {
                stream: "Authentication",
                since: startDate.valueOf(),
                until: startDate.add(2, 'days').valueOf(),
                nextPage: null,
                poll_interval_sec: 1
            };
            try {
                await collector.pawsGetLogs(curState);
            } catch (error) {
                console.log("Error: ", error);
                assert.equal(error.errorCode, 40103);
                getAPILogs.restore();
                getAPIDetails.restore();
            }
        });

        it('Paws Get Logs check throttling error', async function () {

            getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(
                function fakeFn(client, objectDetails, state, accumulator, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return reject({
                            code: 42901,
                            message: 'Too Many Requests',
                            stat: 'FAIL', "errorCode": 42901
                        });
                    });
                });
            getAPIDetails = sinon.stub(utils, 'getAPIDetails').callsFake(
                function fakeFn(state) {
                    const startDate = moment();
                    return {
                        url: "api_url",
                        typeIdPaths: [{ path: ["context"] }],
                        tsPaths: [{ path: ["timestamp"] }],
                        query: {
                            mintime: startDate.unix(),
                            limit: 1000
                        },
                        method: "GET"
                    };
                });
            const creds = await CiscoduoCollector.load();
            var collector = new CiscoduoCollector(ctx, creds, 'ciscoduo');
            const startDate = moment();
            const curState = {
                stream: "telephony",
                since: startDate.unix(),
                poll_interval_sec: 60
            };

            var reportSpy = sinon.spy(collector, 'reportApiThrottling');
            let putMetricDataStub = sinon.stub(CloudWatch.prototype, 'putMetricData').callsFake((params) => Promise.resolve(null));

            const [logs, newState] = await collector.pawsGetLogs(curState);
            assert.equal(true, reportSpy.calledOnce);
            assert.equal(logs.length, 0);
            assert.equal(newState.poll_interval_sec, 120);
            getAPILogs.restore();
            getAPIDetails.restore();
            putMetricDataStub.restore();
        });
    });

   describe('Next state tests', function () {
        const ctx = {
            invokedFunctionArn: ciscoduoMock.FUNCTION_ARN,
            fail: function (error) { assert.fail(error); },
            succeed: function () { }
        };

        // Helper: assert no-future-poll guarantee with a small slack for moment() drift
        // between the SUT and the assertion. 5 s is comfortably above test runtime.
        function assertUntilNotInFutureOfNextInvocation(nextState) {
            const NOW_DRIFT_SLACK_SEC = 5;
            const nextInvocationMs = moment().add(nextState.poll_interval_sec, 'seconds').valueOf();
            const slackMs = NOW_DRIFT_SLACK_SEC * 1000;
            assert.ok(
                nextState.until <= nextInvocationMs + slackMs,
                `until (${nextState.until}) must not exceed next invocation time ` +
                `(${nextInvocationMs}) for stream ${nextState.stream}`
            );
        }

        it('Authentication caught up to real-time: continuity + 60 s window + 300 s wait', async function () {
            const creds = await CiscoduoCollector.load();
            const collector = new CiscoduoCollector(ctx, creds, 'ciscoduo');
            const prevUntil = moment(); // caught up
            const curState = {
                stream: "Authentication",
                since: moment(prevUntil).subtract(60, 'seconds').valueOf(),
                until: prevUntil.valueOf(),
                nextPage: null,
                poll_interval_sec: 60
            };
            const nextState = collector._getNextCollectionState(curState);

            // continuity: no gap, no overlap
            assert.equal(nextState.since, curState.until,
                'nextSince must equal prevUntil so no event is missed');
            // 60 s window (hour-cap returns +pollInterval when hoursDiff < 1)
            assert.equal(
                moment(nextState.until).diff(moment(nextState.since), 'seconds'),
                60
            );
            assert.equal(nextState.poll_interval_sec, 300);
            assertUntilNotInFutureOfNextInvocation(nextState);
        });

        it('Authentication ~10 min behind: continuity + 60 s window + 60 s wait', async function () {
            const creds = await CiscoduoCollector.load();
            const collector = new CiscoduoCollector(ctx, creds, 'ciscoduo');
            const prevUntil = moment().subtract(10, 'minutes');
            const curState = {
                stream: "Authentication",
                since: moment(prevUntil).subtract(60, 'seconds').valueOf(),
                until: prevUntil.valueOf(),
                nextPage: null,
                poll_interval_sec: 60
            };
            const nextState = collector._getNextCollectionState(curState);

            assert.equal(nextState.since, curState.until, 'continuity required');
            assert.equal(
                moment(nextState.until).diff(moment(nextState.since), 'seconds'),
                60
            );
            // Between pollIntervalDelay (300 s) and 15 min behind => returns pollInterval (60 s)
            assert.equal(nextState.poll_interval_sec, 60);
            assertUntilNotInFutureOfNextInvocation(nextState);
        });

        it('Authentication > 1 hr behind: 60 min window + 60 s wait (floored from 1)', async function () {
            const creds = await CiscoduoCollector.load();
            const collector = new CiscoduoCollector(ctx, creds, 'ciscoduo');
            const prevUntil = moment().subtract(3, 'hours');
            const curState = {
                stream: "Authentication",
                since: moment(prevUntil).subtract(60, 'seconds').valueOf(),
                until: prevUntil.valueOf(),
                nextPage: null,
                poll_interval_sec: 60
            };
            const nextState = collector._getNextCollectionState(curState);

            assert.equal(nextState.since, curState.until, 'continuity required');
            // hour-cap widens window to 60 min during backfill
            assert.equal(
                moment(nextState.until).diff(moment(nextState.since), 'minutes'),
                60
            );
            // raw nextPollInterval is 1 (> 15 min behind), floored to 60 s
            assert.equal(nextState.poll_interval_sec, 60);
            assertUntilNotInFutureOfNextInvocation(nextState);
        });

        it('OfflineEnrollment caught up: 15 min window + 15 min wait (no future poll)', async function () {
            const creds = await CiscoduoCollector.load();
            const collector = new CiscoduoCollector(ctx, creds, 'ciscoduo');
            const prevUntil = moment();
            const curState = {
                stream: "OfflineEnrollment",
                since: moment(prevUntil).subtract(15, 'minutes').valueOf(),
                until: prevUntil.valueOf(),
                nextPage: null,
                poll_interval_sec: 900
            };
            const nextState = collector._getNextCollectionState(curState);

            assert.equal(nextState.since, curState.until, 'continuity required');
            assert.equal(
                moment(nextState.until).diff(moment(nextState.since), 'minutes'),
                15,
                'low-traffic streams use a 15 min window per call'
            );
            assert.equal(nextState.poll_interval_sec, 900,
                'low-traffic streams wait the full window when caught up');
            // until is currently ~15 min in the future, but by the time we re-invoke
            // (now + 900 s) it will be at or just behind real-time. This is the
            // guarantee we must not violate.
            assertUntilNotInFutureOfNextInvocation(nextState);
        });

        it('OfflineEnrollment ~30 min behind: 15 min window + 15 min wait', async function () {
            const creds = await CiscoduoCollector.load();
            const collector = new CiscoduoCollector(ctx, creds, 'ciscoduo');
            const prevUntil = moment().subtract(30, 'minutes');
            const curState = {
                stream: "OfflineEnrollment",
                since: moment(prevUntil).subtract(15, 'minutes').valueOf(),
                until: prevUntil.valueOf(),
                nextPage: null,
                poll_interval_sec: 900
            };
            const nextState = collector._getNextCollectionState(curState);

            assert.equal(nextState.since, curState.until, 'continuity required');
            assert.equal(
                moment(nextState.until).diff(moment(nextState.since), 'minutes'),
                15
            );
            assert.equal(nextState.poll_interval_sec, 900);
            assertUntilNotInFutureOfNextInvocation(nextState);
        });

        it('Administrator > 1 hr behind: 60 min window + 60 s wait (backfill catch-up)', async function () {
            const creds = await CiscoduoCollector.load();
            const collector = new CiscoduoCollector(ctx, creds, 'ciscoduo');
            const prevUntil = moment().subtract(6, 'hours');
            const curState = {
                stream: "Administrator",
                since: moment(prevUntil).subtract(15, 'minutes').valueOf(),
                until: prevUntil.valueOf(),
                nextPage: null,
                poll_interval_sec: 900
            };
            const nextState = collector._getNextCollectionState(curState);

            assert.equal(nextState.since, curState.until, 'continuity required');
            assert.equal(
                moment(nextState.until).diff(moment(nextState.since), 'minutes'),
                60,
                'hour-cap widens window to 60 min when far behind'
            );
            // When far behind, we want to catch up fast (60 s), not wait the full 15 min.
            assert.equal(nextState.poll_interval_sec, 60);
            assertUntilNotInFutureOfNextInvocation(nextState);
        });

        it('Telephony with prevUntil in the future: nextSince is clamped to now (no time travel)', async function () {
            const creds = await CiscoduoCollector.load();
            const collector = new CiscoduoCollector(ctx, creds, 'ciscoduo');
            const now = moment();
            const futureUntil = moment(now).add(10, 'minutes');
            const curState = {
                stream: "Telephony",
                since: moment(futureUntil).subtract(15, 'minutes').valueOf(),
                until: futureUntil.valueOf(),
                nextPage: null,
                poll_interval_sec: 900
            };
            const nextState = collector._getNextCollectionState(curState);

            // When prevUntil > now, calcNextCollectionInterval clamps nextSince to now.
            // Allow a small slack because `now` inside the SUT is captured after our `now` here.
            const SLACK_MS = 5 * 1000;
            assert.ok(
                Math.abs(nextState.since - now.valueOf()) <= SLACK_MS,
                `nextSince should be clamped to ~now when prevUntil is in the future; ` +
                `got ${nextState.since}, expected ~${now.valueOf()}`
            );
            assertUntilNotInFutureOfNextInvocation(nextState);
        });

        it('Non-Auth cadence does not leak into a subsequent Authentication call on the same instance', async function () {
            const creds = await CiscoduoCollector.load();
            const collector = new CiscoduoCollector(ctx, creds, 'ciscoduo');
            const pollIntervalBefore = collector.pollInterval;

            const offlineState = {
                stream: "OfflineEnrollment",
                since: moment().subtract(15, 'minutes').valueOf(),
                until: moment().valueOf(),
                nextPage: null,
                poll_interval_sec: 900
            };
            collector._getNextCollectionState(offlineState);

            // The collector instance's pollInterval must not have been mutated.
            assert.equal(collector.pollInterval, pollIntervalBefore,
                '_getNextCollectionState must not mutate this.pollInterval');

            // And the next Auth call must still produce a 60 s window.
            const authState = {
                stream: "Authentication",
                since: moment().subtract(60, 'seconds').valueOf(),
                until: moment().valueOf(),
                nextPage: null,
                poll_interval_sec: 60
            };
            const nextAuth = collector._getNextCollectionState(authState);
            assert.equal(
                moment(nextAuth.until).diff(moment(nextAuth.since), 'seconds'),
                60,
                'Authentication window must remain 60 s after a non-Auth call'
            );
        });
    });

    describe('Format Tests', function () {
        it('log format success', function (done) {
            let ctx = {
                invokedFunctionArn: ciscoduoMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };

            CiscoduoCollector.load().then(function (creds) {
                var collector = new CiscoduoCollector(ctx, creds, 'ciscoduo');
                let fmt = collector.pawsFormatLog(ciscoduoMock.LOG_EVENT);
                assert.equal(fmt.progName, 'CiscoduoCollector');
                assert.ok(fmt.message);
                done();
            });
        });
    });

    describe('NextCollectionStateWithNextPage', function () {
        let ctx = {
            invokedFunctionArn: ciscoduoMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('Get Next Collection State (Authentication) With NextPage Success', function (done) {
            const startDate = moment().subtract(5, 'minutes');
            const curState = {
                stream: "Authentication",
                since: startDate.valueOf(),
                until: startDate.add(5, 'minutes').valueOf(),
                poll_interval_sec: 1
            };
            const nextPage = "nextPage";
            CiscoduoCollector.load().then(function (creds) {
                var collector = new CiscoduoCollector(ctx, creds, 'ciscoduo');
                let nextState = collector._getNextCollectionStateWithNextPage(curState, nextPage);
                assert.ok(nextState.nextPage);
                assert.equal(nextState.nextPage, nextPage);
                done();
            });
        });
        it('Get Next Collection State (OfflineEnrollment) With NextPage Success', function (done) {
            const startDate = moment().subtract(5, 'minutes');
            const curState = {
                stream: "OfflineEnrollment",
                since: startDate.valueOf(),
                until: startDate.add(5, 'minutes').valueOf(),
                nextPage: null,
                poll_interval_sec: 1
            };
            // nextPage is now a next_offset cursor string, NOT a Unix timestamp
            const cursorString = "1666714065304,5bf1a860-fe39-49e3-be29-217659663a74";
            CiscoduoCollector.load().then(function (creds) {
                var collector = new CiscoduoCollector(ctx, creds, 'ciscoduo');
                let nextState = collector._getNextCollectionStateWithNextPage(curState, cursorString);
                assert.equal(nextState.since, curState.since);
                assert.equal(nextState.until, curState.until);
                assert.equal(nextState.nextPage, cursorString);
                assert.equal(nextState.poll_interval_sec, 60);
                done();
            });
        });
    });
});

// Shared fake-client factory used in getAPILogs tests
function makeFakeClient(responses) {
    let callCount = 0;
    return {
        jsonApiCall: function (method, url, query, callback) {
            callback(responses[Math.min(callCount++, responses.length - 1)]);
        }
    };
}

describe('getAPIDetails — url, paths, and query shape', function () {

    it('Authentication: correct url, typeIdPaths, default tsPaths', function () {
        const sinceMs = moment().subtract(1, 'hour').valueOf();
        const untilMs = moment().valueOf();
        const state = { stream: 'Authentication', since: sinceMs, until: untilMs, nextPage: null };
        const d = utils.getAPIDetails(state);
        assert.equal(d.url, '/admin/v2/logs/authentication');
        assert.deepEqual(d.typeIdPaths, [{ path: ['txid'] }]);
        assert.deepEqual(d.tsPaths, [{ path: ['timestamp'] }]);
        assert.equal(d.query.mintime, sinceMs);
        assert.equal(d.query.maxtime, untilMs);
        assert.equal(d.query.limit, 1000);
        assert.ok(!d.query.next_offset);
    });

    it('Authentication: includes next_offset when nextPage is set', function () {
        const state = { stream: 'Authentication', since: 1700000000000, until: 1700060000000, nextPage: 'cursor-abc,txid-xyz' };
        const d = utils.getAPIDetails(state);
        assert.equal(d.query.next_offset, 'cursor-abc,txid-xyz');
    });

    it('Administrator: activity url, activity_id, ts path', function () {
        const state = { stream: 'Administrator', since: 1700000000000, until: 1700060000000, nextPage: null };
        const d = utils.getAPIDetails(state);
        assert.equal(d.url, '/admin/v2/logs/activity');
        assert.deepEqual(d.typeIdPaths, [{ path: ['activity_id'] }]);
        assert.deepEqual(d.tsPaths, [{ path: ['ts'] }]);
    });

    it('Telephony: telephony url, telephony_id, ts path', function () {
        const state = { stream: 'Telephony', since: 1700000000000, until: 1700060000000, nextPage: null };
        const d = utils.getAPIDetails(state);
        assert.equal(d.url, '/admin/v2/logs/telephony');
        assert.deepEqual(d.typeIdPaths, [{ path: ['telephony_id'] }]);
        assert.deepEqual(d.tsPaths, [{ path: ['ts'] }]);
    });

    it('OfflineEnrollment: activity url, activity_id, ts path', function () {
        const state = { stream: 'OfflineEnrollment', since: 1700000000000, until: 1700060000000, nextPage: null };
        const d = utils.getAPIDetails(state);
        assert.equal(d.url, '/admin/v2/logs/activity');
        assert.deepEqual(d.typeIdPaths, [{ path: ['activity_id'] }]);
        assert.deepEqual(d.tsPaths, [{ path: ['ts'] }]);
    });

    it('Unknown stream: returns null url', function () {
        const state = { stream: 'UnknownStream', since: 1700000000000, until: 1700060000000, nextPage: null };
        const d = utils.getAPIDetails(state);
        assert.equal(d.url, null);
    });

    

    it('converts 10-digit seconds since to 13-digit ms (old SQS message)', function () {
        const sinceSec = moment().subtract(1, 'hour').unix();
        assert.ok(sinceSec < utils.MIN_13_DIGIT_TIMESTAMP, 'precondition: sinceSec must be < MIN_13_DIGIT_TIMESTAMP');
        const state = { stream: 'Administrator', since: sinceSec, until: null, nextPage: null };
        const d = utils.getAPIDetails(state);
        assert.equal(d.query.mintime, sinceSec * 1000);
    });

    it('applies fallback until = sinceMs + 60000 when until is null', function () {
        const sinceSec = moment().subtract(1, 'hour').unix();
        const state = { stream: 'Administrator', since: sinceSec, until: null, nextPage: null };
        const d = utils.getAPIDetails(state);
        assert.equal(d.query.maxtime, sinceSec * 1000 + 60000);
    });

    it('applies fallback until = sinceMs + 60000 when until is undefined', function () {
        const sinceMs = moment().subtract(30, 'minutes').valueOf();
        const state = { stream: 'OfflineEnrollment', since: sinceMs, nextPage: null };
        const d = utils.getAPIDetails(state);
        assert.equal(d.query.maxtime, sinceMs + 60000);
    });

    it('converts 10-digit seconds since AND until to ms', function () {
        const sinceSec = moment().subtract(1, 'hour').unix();
        const untilSec = moment().unix();
        const state = { stream: 'Telephony', since: sinceSec, until: untilSec, nextPage: null };
        const d = utils.getAPIDetails(state);
        assert.equal(d.query.mintime, sinceSec * 1000);
        assert.equal(d.query.maxtime, untilSec * 1000);
    });

    it('passes through 13-digit ms timestamps unchanged', function () {
        const sinceMs = moment().subtract(1, 'hour').valueOf();
        const untilMs = moment().valueOf();
        const state = { stream: 'Telephony', since: sinceMs, until: untilMs, nextPage: null };
        const d = utils.getAPIDetails(state);
        assert.equal(d.query.mintime, sinceMs);
        assert.equal(d.query.maxtime, untilMs);
    });
});

describe('getAPILogs — filtering (Administrator / OfflineEnrollment / Telephony)', function () {

    const adminItem    = ciscoduoMock.ACTIVITY_LOG_ADMIN;
    const offlineItem  = ciscoduoMock.ACTIVITY_LOG_OFFLINE;
    const telItem      = ciscoduoMock.TELEPHONY_LOG;
    const noActionItem = { activity_id: 'no-action-id', ts: '2024-01-01T00:00:00+00:00' };
    const actionNoName = { activity_id: 'no-name-id', action: {}, ts: '2024-01-01T00:00:00+00:00' };

    const baseOD = (url) => ({
        method: 'GET', url,
        query: { mintime: 1700000000000, maxtime: 1700060000000, limit: 1000 }
    });

    function singlePageActivity(items) {
        return [{ stat: 'OK', response: { items, metadata: {} } }];
    }

    it('Administrator: excludes o2fa_ items, keeps admin items', async function () {
        const client = makeFakeClient(singlePageActivity([adminItem, offlineItem]));
        const { accumulator } = await utils.getAPILogs(client, baseOD('/admin/v2/logs/activity'), { stream: 'Administrator' }, [], 10);
        assert.equal(accumulator.length, 1);
        assert.equal(accumulator[0].activity_id, adminItem.activity_id);
    });

    it('OfflineEnrollment: keeps only o2fa_ items, excludes admin items', async function () {
        const client = makeFakeClient(singlePageActivity([adminItem, offlineItem]));
        const { accumulator } = await utils.getAPILogs(client, baseOD('/admin/v2/logs/activity'), { stream: 'OfflineEnrollment' }, [], 10);
        assert.equal(accumulator.length, 1);
        assert.equal(accumulator[0].activity_id, offlineItem.activity_id);
    });

    it('Telephony: keeps all items without any filtering', async function () {
        const client = makeFakeClient([{ stat: 'OK', response: { items: [telItem, telItem], metadata: {} } }]);
        const { accumulator } = await utils.getAPILogs(client, baseOD('/admin/v2/logs/telephony'), { stream: 'Telephony' }, [], 10);
        assert.equal(accumulator.length, 2);
    });

    it('Administrator: item with no action field is kept (not treated as offline)', async function () {
        const client = makeFakeClient(singlePageActivity([noActionItem]));
        const { accumulator } = await utils.getAPILogs(client, baseOD('/admin/v2/logs/activity'), { stream: 'Administrator' }, [], 10);
        assert.equal(accumulator.length, 1);
    });

    it('Administrator: item with action but no name is kept', async function () {
        const client = makeFakeClient(singlePageActivity([actionNoName]));
        const { accumulator } = await utils.getAPILogs(client, baseOD('/admin/v2/logs/activity'), { stream: 'Administrator' }, [], 10);
        assert.equal(accumulator.length, 1);
    });

    it('OfflineEnrollment: item with no action field is excluded', async function () {
        const client = makeFakeClient(singlePageActivity([noActionItem, offlineItem]));
        const { accumulator } = await utils.getAPILogs(client, baseOD('/admin/v2/logs/activity'), { stream: 'OfflineEnrollment' }, [], 10);
        assert.equal(accumulator.length, 1);
        assert.equal(accumulator[0].activity_id, offlineItem.activity_id);
    });

    it('OfflineEnrollment: all items filtered out → empty accumulator resolves without error', async function () {
        const client = makeFakeClient(singlePageActivity([adminItem, noActionItem]));
        const { accumulator } = await utils.getAPILogs(client, baseOD('/admin/v2/logs/activity'), { stream: 'OfflineEnrollment' }, [], 10);
        assert.equal(accumulator.length, 0);
    });

    it('rejects when API returns stat FAIL', async function () {
        const client = makeFakeClient([{ stat: 'FAIL', code: 40301, message: 'Access forbidden' }]);
        try {
            await utils.getAPILogs(client, baseOD('/admin/v2/logs/activity'), { stream: 'Administrator' }, [], 10);
            assert.fail('Should have rejected');
        } catch (err) {
            assert.equal(err.stat, 'FAIL');
        }
    });

    it('empty items array resolves with empty accumulator', async function () {
        const client = makeFakeClient([{ stat: 'OK', response: { items: [], metadata: {} } }]);
        const { accumulator } = await utils.getAPILogs(client, baseOD('/admin/v2/logs/activity'), { stream: 'Administrator' }, [], 10);
        assert.equal(accumulator.length, 0);
    });
});

describe('getAPILogs — pagination', function () {

    const authLog  = ciscoduoMock.LOG_EVENT;
    const actLog   = ciscoduoMock.ACTIVITY_LOG_ADMIN;
    const offLog   = ciscoduoMock.ACTIVITY_LOG_OFFLINE;
    const telLog   = ciscoduoMock.TELEPHONY_LOG;

    const authResp = (logs, nextOffset) => ({
        stat: 'OK',
        response: { authlogs: logs, metadata: nextOffset ? { next_offset: nextOffset } : { next_offset: null } }
    });
    const itemsResp = (items, nextOffset) => ({
        stat: 'OK',
        response: { items, metadata: nextOffset ? { next_offset: nextOffset } : {} }
    });

    const baseOD = (url) => ({
        method: 'GET', url,
        query: { mintime: 1700000000000, maxtime: 1700060000000, limit: 1000 }
    });

    it('Authentication: joins next_offset array and fetches next page', async function () {
        const page1 = authResp([authLog], ['1591194557000', 'txid-abc']);
        const page2 = authResp([authLog], null);
        const client = makeFakeClient([page1, page2]);
        const { accumulator, nextPage } = await utils.getAPILogs(client, baseOD('/admin/v2/logs/authentication'), { stream: 'Authentication' }, [], 10);
        assert.equal(accumulator.length, 2);
        assert.equal(nextPage, undefined);
    });

    it('Authentication: stops at maxPagesPerInvocation and preserves joined cursor', async function () {
        const page = authResp([authLog], ['1591194557000', 'txid-abc']);
        const client = makeFakeClient([page, page, page]);
        const od = baseOD('/admin/v2/logs/authentication');
        const { accumulator, nextPage } = await utils.getAPILogs(client, od, { stream: 'Authentication' }, [], 2);
        assert.equal(accumulator.length, 2);
        assert.equal(nextPage, '1591194557000,txid-abc'); // array joined
    });

    it('Activity (Administrator): uses string next_offset for multi-page fetch', async function () {
        const cursor = '1666714065304,uuid-abc';
        const page1 = itemsResp([actLog], cursor);
        const page2 = itemsResp([actLog], null);
        const client = makeFakeClient([page1, page2]);
        const { accumulator, nextPage } = await utils.getAPILogs(client, baseOD('/admin/v2/logs/activity'), { stream: 'Administrator' }, [], 10);
        assert.equal(accumulator.length, 2);
        assert.equal(nextPage, undefined);
    });

    it('Activity (Administrator): stops at maxPagesPerInvocation and preserves cursor', async function () {
        const cursor = '1666714065304,uuid-abc';
        const page = itemsResp([actLog], cursor);
        const client = makeFakeClient([page, page, page]);
        const { accumulator, nextPage } = await utils.getAPILogs(client, baseOD('/admin/v2/logs/activity'), { stream: 'Administrator' }, [], 1);
        assert.equal(accumulator.length, 1);
        assert.equal(nextPage, cursor);
    });

    it('Telephony: stops at maxPagesPerInvocation and preserves cursor', async function () {
        const cursor = '1666714065304,telephony-uuid';
        const page = itemsResp([telLog], cursor);
        const client = makeFakeClient([page, page]);
        const { accumulator, nextPage } = await utils.getAPILogs(client, baseOD('/admin/v2/logs/telephony'), { stream: 'Telephony' }, [], 1);
        assert.equal(accumulator.length, 1);
        assert.equal(nextPage, cursor);
    });

    it('OfflineEnrollment multi-page: filters correctly across pages', async function () {
        const cursor = 'cursor-page2';
        const page1 = itemsResp([actLog, offLog], cursor);   // 1 admin + 1 offline
        const page2 = itemsResp([offLog, actLog], null);     // 1 offline + 1 admin
        const client = makeFakeClient([page1, page2]);
        const { accumulator } = await utils.getAPILogs(client, baseOD('/admin/v2/logs/activity'), { stream: 'OfflineEnrollment' }, [], 10);
        assert.equal(accumulator.length, 2);
        accumulator.forEach(item => assert.ok(item.action.name.startsWith('o2fa_')));
    });

    it('Administrator: all three o2fa_ action values are excluded', async function () {
        const o2fa_items = [
            { activity_id: 'id1', action: { name: 'o2fa_user_provisioned' }, ts: '2024-01-01T00:00:00+00:00' },
            { activity_id: 'id2', action: { name: 'o2fa_user_deprovisioned' }, ts: '2024-01-01T00:00:01+00:00' },
            { activity_id: 'id3', action: { name: 'o2fa_user_reenrolled' }, ts: '2024-01-01T00:00:02+00:00' }
        ];
        const client = makeFakeClient([itemsResp([actLog, ...o2fa_items], null)]);
        const { accumulator } = await utils.getAPILogs(client, baseOD('/admin/v2/logs/activity'), { stream: 'Administrator' }, [], 10);
        assert.equal(accumulator.length, 1);
        assert.equal(accumulator[0].activity_id, actLog.activity_id);
    });

    it('OfflineEnrollment: all three o2fa_ action values are included', async function () {
        const o2fa_items = [
            { activity_id: 'id1', action: { name: 'o2fa_user_provisioned' }, ts: '2024-01-01T00:00:00+00:00' },
            { activity_id: 'id2', action: { name: 'o2fa_user_deprovisioned' }, ts: '2024-01-01T00:00:01+00:00' },
            { activity_id: 'id3', action: { name: 'o2fa_user_reenrolled' }, ts: '2024-01-01T00:00:02+00:00' }
        ];
        const client = makeFakeClient([itemsResp([actLog, ...o2fa_items], null)]);
        const { accumulator } = await utils.getAPILogs(client, baseOD('/admin/v2/logs/activity'), { stream: 'OfflineEnrollment' }, [], 10);
        assert.equal(accumulator.length, 3);
    });

    it('no next_offset returned → second page is never fetched', async function () {
        let callCount = 0;
        const client = {
            jsonApiCall: function (method, url, query, cb) {
                callCount++;
                cb(itemsResp([actLog], null));
            }
        };
        await utils.getAPILogs(client, baseOD('/admin/v2/logs/activity'), { stream: 'Administrator' }, [], 10);
        assert.equal(callCount, 1);
    });
});

describe('collector._getNextCollectionState — unified ms for all streams', function () {
    let ctx = {
        invokedFunctionArn: ciscoduoMock.FUNCTION_ARN,
        fail: function (error) { assert.fail(error); },
        succeed: function () { }
    };

    ['Authentication', 'Administrator', 'Telephony', 'OfflineEnrollment'].forEach(function (stream) {
        it(`${stream}: since/until are ms, nextPage is null`, function (done) {
            CiscoduoCollector.load().then(function (creds) {
                var collector = new CiscoduoCollector(ctx, creds, 'ciscoduo');
                const since = moment().subtract(1, 'hour').valueOf();
                const until = moment().valueOf();
                const curState = { stream, since, until, nextPage: null, poll_interval_sec: 60 };
                const nextState = collector._getNextCollectionState(curState);
                assert.ok(nextState.since > utils.MIN_13_DIGIT_TIMESTAMP, `${stream}: since should be ms`);
                assert.ok(nextState.until > utils.MIN_13_DIGIT_TIMESTAMP, `${stream}: until should be ms`);
                assert.ok(nextState.until > nextState.since);
                assert.strictEqual(nextState.nextPage, null);
                assert.ok(nextState.poll_interval_sec > 0);
                done();
            });
        });
    });

    it('falls back gracefully when until is absent (old in-flight SQS without until)', function (done) {
        CiscoduoCollector.load().then(function (creds) {
            var collector = new CiscoduoCollector(ctx, creds, 'ciscoduo');
            const curState = { stream: 'Administrator', since: moment().subtract(1, 'hour').unix(), poll_interval_sec: 240 };
            assert.doesNotThrow(() => {
                const nextState = collector._getNextCollectionState(curState);
                assert.ok(nextState.since > 0);
                assert.ok(nextState.until > 0);
                assert.strictEqual(nextState.nextPage, null);
            });
            done();
        });
    });
});

describe('collector._getNextCollectionStateWithNextPage — unified for all streams', function () {
    let ctx = {
        invokedFunctionArn: ciscoduoMock.FUNCTION_ARN,
        fail: function (error) { assert.fail(error); },
        succeed: function () { }
    };
    const cursor = '1666714065304,5bf1a860-fe39-49e3-be29-217659663a74';

    ['Authentication', 'Administrator', 'Telephony', 'OfflineEnrollment'].forEach(function (stream) {
        it(`${stream}: preserves since/until from curState, stores cursor in nextPage`, function (done) {
            CiscoduoCollector.load().then(function (creds) {
                var collector = new CiscoduoCollector(ctx, creds, 'ciscoduo');
                const since = moment().subtract(5, 'minutes').valueOf();
                const until = moment().valueOf();
                const curState = { stream, since, until, nextPage: null, poll_interval_sec: 60 };
                const nextState = collector._getNextCollectionStateWithNextPage(curState, cursor);
                assert.equal(nextState.since, since, `${stream}: since must not change`);
                assert.equal(nextState.until, until, `${stream}: until must not change`);
                assert.equal(nextState.nextPage, cursor, `${stream}: nextPage must be cursor`);
                assert.equal(nextState.poll_interval_sec, 60);
                done();
            });
        });
    });

    it('non-Auth: cursor string is NOT used as since (regression guard)', function (done) {
        CiscoduoCollector.load().then(function (creds) {
            var collector = new CiscoduoCollector(ctx, creds, 'ciscoduo');
            const since = moment().subtract(5, 'minutes').valueOf();
            const curState = { stream: 'Administrator', since, until: moment().valueOf(), nextPage: null, poll_interval_sec: 60 };
            const nextState = collector._getNextCollectionStateWithNextPage(curState, cursor);
            assert.notEqual(nextState.since, cursor, 'since must never be the cursor string');
            assert.equal(nextState.since, since);
            done();
        });
    });
});

describe('collector.pawsInitCollectionState — all streams use ms timestamps', function () {
    let ctx = {
        invokedFunctionArn: ciscoduoMock.FUNCTION_ARN,
        fail: function (error) { assert.fail(error); },
        succeed: function () { }
    };

    it('all four streams emit since/until as 13-digit ms with nextPage null', async function () {
        const creds = await CiscoduoCollector.load();
        var collector = new CiscoduoCollector(ctx, creds, 'ciscoduo');
        process.env.paws_collection_start_ts = moment().subtract(1, 'days').toISOString();
        const { state } = await collector.pawsInitCollectionState();
        assert.equal(state.length, 4);
        state.forEach(s => {
            assert.ok(s.since > 1e12, `${s.stream}: since must be ms`);
            assert.ok(s.until > 1e12, `${s.stream}: until must be ms`);
            assert.ok(s.until > s.since, `${s.stream}: until must be after since`);
            assert.strictEqual(s.nextPage, null, `${s.stream}: nextPage must be null`);
        });
    });
});


describe('Backward compat — legacy SQS message (seconds, no until)', function () {
    let ctx = {
        invokedFunctionArn: ciscoduoMock.FUNCTION_ARN,
        fail: function (error) { assert.fail(error); },
        succeed: function () { }
    };

    it('getAPIDetails: builds valid ms mintime/maxtime from old seconds-only state', function () {
        const oldState = { stream: 'Administrator', since: moment().subtract(1, 'hour').unix(), nextPage: null };
        assert.ok(oldState.since < utils.MIN_13_DIGIT_TIMESTAMP, 'precondition: old state since is seconds');
        const d = utils.getAPIDetails(oldState);
        assert.ok(d.query.mintime > utils.MIN_13_DIGIT_TIMESTAMP, 'mintime must be 13-digit ms');
        assert.ok(d.query.maxtime > utils.MIN_13_DIGIT_TIMESTAMP, 'maxtime must be 13-digit ms');
        assert.equal(d.query.maxtime - d.query.mintime, 60000);
    });

    it('getAPIDetails: builds valid ms query from old seconds state with seconds until', function () {
        const sinceSec = moment().subtract(1, 'hour').unix();
        const untilSec = moment().unix();
        const oldState = { stream: 'Telephony', since: sinceSec, until: untilSec, nextPage: null };
        const d = utils.getAPIDetails(oldState);
        assert.ok(d.query.mintime > utils.MIN_13_DIGIT_TIMESTAMP);
        assert.ok(d.query.maxtime > utils.MIN_13_DIGIT_TIMESTAMP);
        assert.equal(d.query.mintime, sinceSec * 1000);
        assert.equal(d.query.maxtime, untilSec * 1000);
    });

    it('_getNextCollectionState does not throw for old state without until', function (done) {
        CiscoduoCollector.load().then(function (creds) {
            var collector = new CiscoduoCollector(ctx, creds, 'ciscoduo');
            const oldState = { stream: 'Administrator', since: moment().subtract(1, 'hour').unix(), poll_interval_sec: 240 };
            assert.doesNotThrow(() => {
                const nextState = collector._getNextCollectionState(oldState);
                assert.ok(nextState.since > 0);
                assert.ok(nextState.until > 0);
            });
            done();
        });
    });

    it('pawsGetLogs succeeds with old Administrator state (seconds, no until)', async function () {
        getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(function () {
            return Promise.resolve({ accumulator: [ciscoduoMock.ACTIVITY_LOG_ADMIN], nextPage: null });
        });
        getAPIDetails = sinon.stub(utils, 'getAPIDetails').callsFake(function () {
            return {
                url: '/admin/v2/logs/activity',
                typeIdPaths: [{ path: ['activity_id'] }],
                tsPaths: [{ path: ['ts'] }],
                query: { mintime: 1700000000000, maxtime: 1700060000000, limit: 1000 },
                method: 'GET'
            };
        });
        const creds = await CiscoduoCollector.load();
        var collector = new CiscoduoCollector(ctx, creds, 'ciscoduo');
        const oldState = { stream: 'Administrator', since: moment().subtract(1, 'hour').unix(), poll_interval_sec: 240 };
        const [logs, newState] = await collector.pawsGetLogs(oldState);
        assert.equal(logs.length, 1);
        assert.ok(newState.since > 0);
        getAPILogs.restore();
        getAPIDetails.restore();
    });
});
