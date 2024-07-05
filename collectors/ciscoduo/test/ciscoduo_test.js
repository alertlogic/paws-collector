const assert = require('assert');
const sinon = require('sinon');
const m_response = require('cfn-response');
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


    describe('Paws Init Collection State', function () {
        let ctx = {
            invokedFunctionArn: ciscoduoMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('Paws Init Collection State Success', function (done) {
            CiscoduoCollector.load().then(function (creds) {
                var collector = new CiscoduoCollector(ctx, creds, 'ciscoduo');
                const startDate = moment().subtract(1, 'days').toISOString();
                process.env.paws_collection_start_ts = startDate;

                collector.pawsInitCollectionState(null, (err, initialStates, nextPoll) => {
                    initialStates.forEach((state) => {
                        if (state.object === "Authentication") {
                            assert.equal(moment(parseInt(state.until)).diff(parseInt(state.since), 'seconds'), 60);
                        }
                        else {
                            assert.equal(state.poll_interval_sec, 240);
                            assert.ok(state.since);
                        }
                    });
                    done();
                });
            });
        });
    });

    describe('Paws Get Register Parameters', function () {
        it('Paws Get Register Parameters Success', function (done) {
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
                const sampleEvent = { ResourceProperties: { StackName: 'a-stack-name' } };
                collector.pawsGetRegisterParameters(sampleEvent, (err, regValues) => {
                    const expectedRegValues = {
                        ciscoduoObjectNames: '[\"Authentication\", \"Administrator\",\"Telephony\", \"OfflineEnrollment\"]',
                    };
                    assert.deepEqual(regValues, expectedRegValues);
                    done();
                });
            });
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
        it('Paws Get Logs Success', function (done) {
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
            CiscoduoCollector.load().then(function (creds) {
                var collector = new CiscoduoCollector(ctx, creds, 'ciscoduo');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    stream: "Authentication",
                    since: startDate.valueOf(),
                    until: startDate.add(2, 'days').valueOf(),
                    nextPage: null,
                    poll_interval_sec: 1
                };
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(logs.length, 2);
                    assert.equal(newState.poll_interval_sec, 60);
                    assert.ok(logs[0].txid);
                    getAPILogs.restore();
                    getAPIDetails.restore();
                    done();
                });

            });
        });

        it('Paws Get Logs With NextPage Success', function (done) {
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
            CiscoduoCollector.load().then(function (creds) {
                var collector = new CiscoduoCollector(ctx, creds, 'ciscoduo');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    stream: "Authentication",
                    since: startDate.valueOf(),
                    until: startDate.add(2, 'days').valueOf(),
                    nextPage: null,
                    poll_interval_sec: 1
                };
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(logs.length, 2);
                    assert.equal(newState.poll_interval_sec, 60);
                    assert.equal(newState.nextPage, "nextPage");
                    assert.ok(logs[0].txid);
                    getAPILogs.restore();
                    getAPIDetails.restore();
                    done();
                });

            });
        });

        it('Paws Get client error', function (done) {

            getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(
                function fakeFn(client, objectDetails, state, accumulator, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return reject({ code: 40103,
                            message: 'Invalid signature in request credentials',
                            stat: 'FAIL' });
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
            CiscoduoCollector.load().then(function (creds) {
                var collector = new CiscoduoCollector(ctx, creds, 'ciscoduo');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    stream: "Authentication",
                    since: startDate.valueOf(),
                    until: startDate.add(2, 'days').valueOf(),
                    nextPage: null,
                    poll_interval_sec: 1
                };
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(err.errorCode, 40103);
                    getAPILogs.restore();
                    getAPIDetails.restore();
                    done();
                });

            });
        });

        it('Paws Get Logs check throttling error', function (done) {

            getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(
                function fakeFn(client, objectDetails, state, accumulator, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return reject({ code: 42901,
                            message: 'Too Many Requests',
                            stat: 'FAIL' ,"errorCode":42901});
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
            CiscoduoCollector.load().then(function (creds) {
                var collector = new CiscoduoCollector(ctx, creds, 'ciscoduo');
                const startDate = moment();
                const curState = {
                    stream: "telephony",
                    since: startDate.unix(),
                    poll_interval_sec: 60
                };

                var reportSpy = sinon.spy(collector, 'reportApiThrottling');
                let putMetricDataStub = sinon.stub(CloudWatch.prototype, 'putMetricData').callsFake((params, callback) => callback());
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(true, reportSpy.calledOnce);
                    assert.equal(logs.length, 0);
                    assert.equal(newState.poll_interval_sec, 120);
                    getAPILogs.restore();
                    getAPIDetails.restore();
                    putMetricDataStub.restore();
                    done();
                });

            });
        });
    });

    describe('Next state tests', function () {
        let ctx = {
            invokedFunctionArn: ciscoduoMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };

        it('Next state tests success with Authentication', function (done) {
            CiscoduoCollector.load().then(function (creds) {
                var collector = new CiscoduoCollector(ctx, creds, 'ciscoduo');
                const startDate = moment();
                const curState = {
                    stream: "Authentication",
                    since: startDate.valueOf(),
                    until: startDate.add(collector.pollInterval, 'seconds').valueOf(),
                    nextPage: null,
                    poll_interval_sec: 1
                };
                let nextState = collector._getNextCollectionState(curState);
                assert.equal(nextState.poll_interval_sec, process.env.paws_poll_interval_delay);
                done();
            });
        });

        it('Next state tests success with Authentication call for one hr interval if start date is more than 1 hr', function (done) {
            CiscoduoCollector.load().then(function (creds) {
                var collector = new CiscoduoCollector(ctx, creds, 'ciscoduo');
                const startDate = moment().subtract(1,'days');
                const curState = {
                    stream: "Authentication",
                    since: startDate.valueOf(),
                    until: startDate.add(collector.pollInterval, 'seconds').valueOf(),
                    nextPage: null,
                    poll_interval_sec: 1
                };
                let nextState = collector._getNextCollectionState(curState);
                assert.equal(nextState.poll_interval_sec, 60);
                assert.equal(moment(parseInt(nextState.until)).diff(parseInt(nextState.since), 'minutes'), 60);
                done();
            });
        });

        it('Next state tests success with OfflineEnrollment', function (done) {
            CiscoduoCollector.load().then(function (creds) {
                var collector = new CiscoduoCollector(ctx, creds, 'ciscoduo');
                const startDate = moment().subtract(1, 'hours');
                const curState = {
                    stream: "OfflineEnrollment",
                    since: startDate.unix(),
                    poll_interval_sec: 1
                };
                let nextState = collector._getNextCollectionState(curState);
                // If there is no data check next api call is after 15min
                assert.equal(nextState.poll_interval_sec, 900);
                assert.equal(nextState.since, curState.since + 1);

                done();
            });
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
                since: startDate.unix(),
                poll_interval_sec: 1
            };
            const nextPageTimestamp = "1574157600";
            CiscoduoCollector.load().then(function (creds) {
                var collector = new CiscoduoCollector(ctx, creds, 'ciscoduo');
                let nextState = collector._getNextCollectionStateWithNextPage(curState, nextPageTimestamp);
                assert.ok(nextState.since);
                assert.equal(nextState.since, nextPageTimestamp);
                done();
            });
        });
    });
});
