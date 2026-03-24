const assert = require('assert');
const sinon = require('sinon');
const m_response = require('@alertlogic/al-aws-collector-js').CfnResponse;
const mimecastMock = require('./mimecast_mock');
var MimecastCollector = require('../collector').MimecastCollector;
const moment = require('moment');
const utils = require("../utils");
const { CloudWatch } = require("@aws-sdk/client-cloudwatch"),
    { KMS } = require("@aws-sdk/client-kms"),
    { SSM } = require("@aws-sdk/client-ssm");

var responseStub = {};
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
        SSM.prototype.getParameter.restore();
        KMS.prototype.decrypt.restore();
    });

    describe('pawsInitCollectionState', function () {
        let ctx = {
            invokedFunctionArn: mimecastMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('Paws Init Collection State', async function () {
            const creds = await MimecastCollector.load();
            var collector = new MimecastCollector(ctx, creds, 'mimecast');
            const startDate = moment().utc().format();
            process.env.paws_collection_start_ts = startDate;
            const { state: initialStates } = await collector.pawsInitCollectionState({});
            initialStates.forEach((state) => {
                assert.equal(state.poll_interval_sec, 1);
                if (state.stream !== "SiemLogs" && state.stream !== "MalwareFeed") {
                    assert.equal(moment(state.until).diff(state.since, 'seconds'), 60);
                }
            });
        });
    });

    describe('Paws Get Register Parameters', function () {
        it('Paws Get Register Parameters Success', async function () {
            let ctx = {
                invokedFunctionArn: mimecastMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                },
                succeed: function () { }
            };
            const creds = await MimecastCollector.load();
            var collector = new MimecastCollector(ctx, creds, 'mimecast');
            const sampleEvent = { ResourceProperties: { StackName: 'a-stack-name' } };
            const regValues = await collector.pawsGetRegisterParameters(sampleEvent);
            const expectedRegValues = {
                mimecastApplicationNames: '[\"SiemLogs\", \"AttachmentProtectLogs\", \"URLProtectLogs\", \"MalwareFeed\" ]'
            };
            assert.deepEqual(regValues, expectedRegValues);
        });
    });

    describe('pawsGetLogs', function () {
        let ctx = {
            invokedFunctionArn: mimecastMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('Paws Get Logs Success', async function () {
            getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(
                function fakeFn(authDetails, state, accumulator, maxPagesPerInvocation) {
                    return Promise.resolve({ accumulator: [mimecastMock.ATTACHMENT_PROTECT_LOGS_EVENT, mimecastMock.ATTACHMENT_PROTECT_LOGS_EVENT] });
                });
            try {
                const creds = await MimecastCollector.load();
                var collector = new MimecastCollector(ctx, creds, 'mimecast');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    stream: "AttachmentProtectLogs",
                    since: startDate.utc().format(),
                    until: startDate.add(2, 'days').utc().format(),
                    nextPage: null,
                    poll_interval_sec: 1
                };
                const [logs, newState] = await collector.pawsGetLogs(curState);
                assert.equal(logs.length, 2);
                assert.equal(newState.poll_interval_sec, 1);
                assert.ok(logs[0].result);
            } finally {
                getAPILogs.restore();
            }
        });

        it('Paws Get Logs with nextpage Success', async function () {
            getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(
                function fakeFn(authDetails, state, accumulator, maxPagesPerInvocation) {
                    return Promise.resolve({ accumulator: [mimecastMock.ATTACHMENT_PROTECT_LOGS_EVENT, mimecastMock.ATTACHMENT_PROTECT_LOGS_EVENT], nextPage: "nextPage" });
                });
            try {
                const creds = await MimecastCollector.load();
                var collector = new MimecastCollector(ctx, creds, 'mimecast');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    stream: "AttachmentProtectLogs",
                    since: startDate.utc().format(),
                    until: startDate.add(2, 'days').utc().format(),
                    nextPage: null,
                    poll_interval_sec: 1
                };
                const [logs, newState] = await collector.pawsGetLogs(curState);
                assert.equal(logs.length, 2);
                assert.equal(newState.poll_interval_sec, 1);
                assert.equal(newState.nextPage, "nextPage");
                assert.ok(logs[0].result);
            } finally {
                getAPILogs.restore();
            }
        });

        it('Paws Get Logs with error Success', async function () {
            getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(
                function fakeFn(authDetails, state, accumulator, maxPagesPerInvocation) {
                    return Promise.reject({ "code": "error code", "message": "error message", "retryable": false });
                });
            try {
                const creds = await MimecastCollector.load();
                var collector = new MimecastCollector(ctx, creds, 'mimecast');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    stream: "SiemLogs",
                    since: startDate.utc().format(),
                    until: startDate.add(2, 'days').utc().format(),
                    nextPage: null,
                    poll_interval_sec: 1
                };
                try {
                    await collector.pawsGetLogs(curState);
                    assert.fail('Expected pawsGetLogs to reject');
                } catch (err) {
                    assert.ok(err.code);
                }
            } finally {
                getAPILogs.restore();
            }
        });

        it('Paws Get Logs with Api Throttling error Success', async function () {
            getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(
                function fakeFn(authDetails, state, accumulator, maxPagesPerInvocation) {
                    return Promise.reject({ response: { status: 429 } });
                });
            let putMetricDataStub;
            try {
                const creds = await MimecastCollector.load();
                var collector = new MimecastCollector(ctx, creds, 'mimecast');
                const curState = {
                    stream: "MalwareFeed",
                    nextPage: null,
                    poll_interval_sec: 1
                };
                var reportSpy = sinon.spy(collector, 'reportApiThrottling');
                putMetricDataStub = sinon.stub(CloudWatch.prototype, 'putMetricData').callsFake(() => Promise.resolve());
                const [logs, newState] = await collector.pawsGetLogs(curState);
                assert.equal(logs.length, 0);
                assert.equal(newState.poll_interval_sec, 900);
                assert.equal(true, reportSpy.calledOnce);
            } finally {
                getAPILogs.restore();
                if (putMetricDataStub) {
                    putMetricDataStub.restore();
                }
            }
        });

    });

    describe('Next state tests', function () {
        let ctx = {
            invokedFunctionArn: mimecastMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };

        it('Next state tests success with SiemLogs', async function () {
            const creds = await MimecastCollector.load();
            var collector = new MimecastCollector(ctx, creds, 'mimecast');
            const curState = {
                stream: "SiemLogs",
                nextPage: null,
                poll_interval_sec: 1
            };
            let nextState = collector._getNextCollectionState(curState);
            assert.equal(nextState.poll_interval_sec, 1);
            assert.equal(nextState.stream, "SiemLogs");
        });

        it('Next state tests success with AttachmentProtectLogs', async function () {
            const creds = await MimecastCollector.load();
            var collector = new MimecastCollector(ctx, creds, 'mimecast');
            const startDate = moment();
            const curState = {
                stream: "AttachmentProtectLogs",
                since: startDate.utc().format(),
                until: startDate.add(collector.pollInterval, 'seconds').utc().format(),
                nextPage: null,
                poll_interval_sec: 1
            };
            let nextState = collector._getNextCollectionState(curState);
            assert.equal(nextState.poll_interval_sec, 300);
            assert.equal(nextState.stream, "AttachmentProtectLogs");
        });
    });

    describe('Format Tests', function () {
        it('log format success', async function () {
            let ctx = {
                invokedFunctionArn: mimecastMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                },
                succeed: function () { }
            };

            const creds = await MimecastCollector.load();
            var collector = new MimecastCollector(ctx, creds, 'mimecast');
            let fmt = collector.pawsFormatLog(mimecastMock.ATTACHMENT_PROTECT_LOGS_EVENT);
            assert.equal(fmt.progName, 'MimecastCollector');
            assert.ok(fmt.message);
        });
    });

    describe('NextCollectionStateWithNextPage', function () {
        let ctx = {
            invokedFunctionArn: mimecastMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('Get Next Collection State (SiemLogs) With NextPage Success', async function () {
            const curState = {
                stream: "SiemLogs",
                poll_interval_sec: 1
            };
            const nextPage = "nextPage";
            const creds = await MimecastCollector.load();
            var collector = new MimecastCollector(ctx, creds, 'mimecast');
            let nextState = collector._getNextCollectionStateWithNextPage(curState, nextPage);
            assert.ok(nextState.nextPage);
            assert.equal(nextState.nextPage, nextPage);
            assert.equal(nextState.stream, "SiemLogs");
        });
        it('Get Next Collection State (AttachmentProtectLogs) With NextPage Success', async function () {
            const startDate = moment().subtract(5, 'minutes');
            const curState = {
                stream: "AttachmentProtectLogs",
                since: startDate.utc().format(),
                until: startDate.add(5, 'minutes').utc().format(),
                poll_interval_sec: 1
            };
            const nextPage = "nextPage";
            const creds = await MimecastCollector.load();
            var collector = new MimecastCollector(ctx, creds, 'mimecast');
            let nextState = collector._getNextCollectionStateWithNextPage(curState, nextPage);
            assert.ok(nextState.nextPage);
            assert.equal(nextState.nextPage, nextPage);
            assert.equal(nextState.stream, "AttachmentProtectLogs");
        });
    });
});
