const assert = require('assert');
const sinon = require('sinon');
var AWS = require('aws-sdk-mock');
const m_response = require('cfn-response');
const mimecastMock = require('./mimecast_mock');
var MimecastCollector = require('../collector').MimecastCollector;
const moment = require('moment');
const utils = require("../utils");

var responseStub = {};
let getAPILogs;
describe('Unit Tests', function() {

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
            invokedFunctionArn: mimecastMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('Paws Init Collection State', function (done) {
            MimecastCollector.load().then(function (creds) {
                var collector = new MimecastCollector(ctx, creds, 'mimecast');
                const startDate = moment().toISOString();
                process.env.paws_collection_start_ts = startDate;
                collector.pawsInitCollectionState({}, (err, initialStates, nextPoll) => {
                    initialStates.forEach((state) => {
                        assert.equal(state.poll_interval_sec, 1);
                        if (state.applicationName !== "SiemLogs") {
                            assert.equal(moment(state.until).diff(state.since, 'seconds'), 60);
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
                invokedFunctionArn: mimecastMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };

            MimecastCollector.load().then(function (creds) {
                var collector = new MimecastCollector(ctx, creds, 'mimecast');
                const sampleEvent = { ResourceProperties: { StackName: 'a-stack-name' } };
                collector.pawsGetRegisterParameters(sampleEvent, (err, regValues) => {
                    const expectedRegValues = {
                        mimecastApplicationID: "APPLICATION_ID",
                        mimecastApplicationKey: 'APPLICATION_KEY',
                        mimecastApplicationNames: '[\"SiemLogs\", \"AttachmentProtectLogs\", \"URLProtectLogs\", \"MalwareFeed\" ]',
                    };
                    assert.deepEqual(regValues, expectedRegValues);
                    done();
                });
            });
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
        it('Paws Get Logs Success', function (done) {
            getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(
                function fakeFn(authDetails, state, accumulator, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return resolve({ accumulator: [mimecastMock.LOG_EVENT, mimecastMock.LOG_EVENT] });
                    });
                });
                MimecastCollector.load().then(function (creds) {
                var collector = new MimecastCollector(ctx, creds, 'mimecast');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    applicationName: "AttachmentProtectLogs",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    nextPage: null,
                    poll_interval_sec: 1
                };
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(logs.length, 2);
                    assert.equal(newState.poll_interval_sec, 1);
                    assert.ok(logs[0].result);
                    getAPILogs.restore();
                    done();
                });
            });
        });

        it('Paws Get Logs with nextpage Success', function (done) {
            getAPILogs = sinon.stub(utils, 'getAPILogs').callsFake(
                function fakeFn(authDetails, state, accumulator, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return resolve({ accumulator: [mimecastMock.LOG_EVENT, mimecastMock.LOG_EVENT], nextPage: "nextPage" });
                    });
                });
                MimecastCollector.load().then(function (creds) {
                var collector = new MimecastCollector(ctx, creds, 'mimecast');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    applicationName: "AttachmentProtectLogs",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    nextPage: null,
                    poll_interval_sec: 1
                };
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(logs.length, 2);
                    assert.equal(newState.poll_interval_sec, 1);
                    assert.ok(logs[0].result);
                    getAPILogs.restore();
                    done();
                });
            });
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

        it('Next state tests success with SiemLogs', function (done) {
            MimecastCollector.load().then(function (creds) {
                var collector = new MimecastCollector(ctx, creds, 'mimecast');
                const curState = {
                    applicationName: "SiemLogs",
                    nextPage: null,
                    poll_interval_sec: 1
                };
                let nextState = collector._getNextCollectionState(curState);
                assert.equal(nextState.poll_interval_sec, 1);
                done();
            });
        });

        it('Next state tests success with AttachmentProtectLogs', function (done) {
            MimecastCollector.load().then(function (creds) {
                var collector = new MimecastCollector(ctx, creds, 'mimecast');
                const startDate = moment();
                const curState = {
                    applicationName: "AttachmentProtectLogs",
                    since: startDate.toISOString(),
                    until: startDate.add(collector.pollInterval, 'seconds').toISOString(),
                    nextPage: null,
                    poll_interval_sec: 1
                };
                let nextState = collector._getNextCollectionState(curState);
                assert.equal(nextState.poll_interval_sec, collector.pollInterval);
                done();
            });
        });
    });

    describe('Format Tests', function() {
        it('log format success', function(done) {
            let ctx = {
                invokedFunctionArn : mimecastMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            
            MimecastCollector.load().then(function(creds) {
                var collector = new MimecastCollector(ctx, creds, 'mimecast');
                let fmt = collector.pawsFormatLog(mimecastMock.LOG_EVENT);
                assert.equal(fmt.progName, 'MimecastCollector');
                assert.ok(fmt.message);
                done();
            });
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
        it('Get Next Collection State (SiemLogs) With NextPage Success', function (done) {
            const curState = {
                applicationName: "SiemLogs",
                poll_interval_sec: 1
            };
            const nextPage = "nextPage";
            MimecastCollector.load().then(function (creds) {
                var collector = new MimecastCollector(ctx, creds, 'mimecast');
                let nextState = collector._getNextCollectionStateWithNextPage(curState, nextPage);
                assert.ok(nextState.nextPage);
                assert.equal(nextState.nextPage, nextPage);
                done();
            });
        });
        it('Get Next Collection State (AttachmentProtectLogs) With NextPage Success', function (done) {
            const startDate = moment().subtract(5, 'minutes');
            const curState = {
                applicationName: "AttachmentProtectLogs",
                since: startDate.toISOString(),
                until: startDate.add(5, 'minutes').toISOString(),
                poll_interval_sec: 1
            };
            const nextPage = "nextPage";
            MimecastCollector.load().then(function (creds) {
                var collector = new MimecastCollector(ctx, creds, 'mimecast');
                let nextState = collector._getNextCollectionStateWithNextPage(curState, nextPage);
                assert.ok(nextState.nextPage);
                assert.equal(nextState.nextPage, nextPage);
                done();
            });
        });
    });
});
