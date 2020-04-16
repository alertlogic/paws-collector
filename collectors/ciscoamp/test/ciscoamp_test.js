const assert = require('assert');
const sinon = require('sinon');
var AWS = require('aws-sdk-mock');
const m_response = require('cfn-response');
const ciscoampMock = require('./ciscoamp_mock');
var CiscoampCollector = require('../collector').CiscoampCollector;
const moment = require('moment');
const utils = require("../utils");


var responseStub = {};
let getAPIDetails;

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

    describe('Paws Init Collection State', function () {
        let ctx = {
            invokedFunctionArn: ciscoampMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('Paws Init Collection State Success', function (done) {
            CiscoampCollector.load().then(function (creds) {
                var collector = new CiscoampCollector(ctx, creds, 'ciscoamp');
                const startDate = moment().subtract(1, 'days').toISOString();
                process.env.paws_collection_start_ts = startDate;

                collector.pawsInitCollectionState(null, (err, initialStates, nextPoll) => {
                    initialStates.forEach((state) => {
                        assert.equal(moment(state.until).diff(state.since, 'seconds'), 60);
                    });
                    done();
                });
            });
        });
    });

    describe('Paws Get Register Parameters', function () {
        it('Paws Get Register Parameters Success', function (done) {
            let ctx = {
                invokedFunctionArn: ciscoampMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };

            CiscoampCollector.load().then(function (creds) {
                var collector = new CiscoampCollector(ctx, creds, 'ciscoamp');
                const sampleEvent = { ResourceProperties: { StackName: 'a-stack-name' } };
                collector.pawsGetRegisterParameters(sampleEvent, (err, regValues) => {
                    const expectedRegValues = {
                        ciscoampResources: '[\"AuditLogs\",\"Events\"]',
                    };
                    assert.deepEqual(regValues, expectedRegValues);
                    done();
                });
            });
        });
    });

    describe('pawsGetLogs', function () {
        let ctx = {
            invokedFunctionArn: ciscoampMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('Paws Get Logs Success', function (done) {
            getAPIDetails = sinon.stub(utils, 'getAPIDetails').callsFake(
                function fakeFn(state) {
                    return {
                        url: "api_url"
                    };
                });
            CiscoampCollector.load().then(function (creds) {
                var collector = new CiscoampCollector(ctx, creds, 'ciscoamp');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    resource: "AuditLogs",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    nextPage: null,
                    poll_interval_sec: 1
                };
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(logs.length, 0);
                    assert.equal(newState.poll_interval_sec, 1);
                    getAPIDetails.restore();
                    done();
                });

            });
        });
    });

    describe('Next state tests', function () {
        it('log format success', function (done) {
            let ctx = {
                invokedFunctionArn: ciscoampMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };

            CiscoampCollector.load().then(function (creds) {
                var collector = new CiscoampCollector(ctx, creds, 'ciscoamp');
                const startDate = moment();
                const curState = {
                    resource: "AuditLogs",
                    since: startDate.toISOString(),
                    until: startDate.add(collector.pollInterval, 'seconds').toISOString(),
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
                invokedFunctionArn: ciscoampMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };

            CiscoampCollector.load().then(function (creds) {
                var collector = new CiscoampCollector(ctx, creds, 'ciscoamp');
                let fmt = collector.pawsFormatLog(ciscoampMock.LOG_EVENT);
                assert.equal(fmt.progName, 'CiscoampCollector');
                assert.ok(fmt.message);
                done();
            });
        });
    });
});
