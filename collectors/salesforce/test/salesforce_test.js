const assert = require('assert');
const sinon = require('sinon');
var AWS = require('aws-sdk-mock');
const m_response = require('cfn-response');
const salesforceMock = require('./salesforce_mock');
var SalesforceCollector = require('../collector').SalesforceCollector;
const moment = require('moment');
const utils = require("../utils");
var jwt = require('jsonwebtoken');
const RestServiceClient = require('@alertlogic/al-collector-js').RestServiceClient;


var responseStub = {};
let getObjectLogs;
let getObjectQuery;
let token;
let requestPost;
function setAlServiceStub() {
    token = sinon.stub(jwt, 'sign').callsFake(
        function fakeFn(path) {
            return {};
        });

    requestPost = sinon.stub(RestServiceClient.prototype, 'post').callsFake(
        function fakeFn(path, extraOptions) {
            return new Promise(function (resolve, reject) {
                return resolve(salesforceMock.LOG_EVENT);
            });
        });

    getObjectQuery = sinon.stub(utils, 'getObjectQuery').callsFake(
        function fakeFn(state) {
            return {
                query: "query",
                tsPaths: [{ path: ["LastLoginDate"] }],
                sortFieldName: "sortFieldName",
                sortType: "sortType"
            };
        });

}

function restoreAlServiceStub() {

    token.restore();
    requestPost.restore();
    getObjectQuery.restore();
}

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
        restoreAlServiceStub();
        responseStub.restore();
    });

    describe('Paws Init Collection State', function () {
        let ctx = {
            invokedFunctionArn: salesforceMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        beforeEach(function(){
            setAlServiceStub();
        });
        it('get inital state less than 7 days in the past', function (done) {
            SalesforceCollector.load().then(function (creds) {
                var collector = new SalesforceCollector(ctx, creds, 'salesforce');
                const startDate = moment().subtract(1, 'days').toISOString();
                process.env.paws_collection_start_ts = startDate;

                collector.pawsInitCollectionState(null, (err, initialStates, nextPoll) => {
                    initialStates.forEach((state) => {
                        assert.equal(state.since, startDate, "Dates are not equal");
                        assert.notEqual(moment(state.until).diff(state.since, 'hours'), 24);
                    });
                    done();
                });
            });
        });
        it('get inital state less than 24 hours in the past', function (done) {
            SalesforceCollector.load().then(function (creds) {
                var collector = new SalesforceCollector(ctx, creds, 'salesforce');
                const startDate = moment().subtract(12, 'hours').toISOString();
                process.env.paws_collection_start_ts = startDate;

                collector.pawsInitCollectionState(null, (err, initialStates, nextPoll) => {
                    initialStates.forEach((state) => {
                        assert.notEqual(moment(state.until).diff(state.since, 'hours'), 24);
                    });
                    done();
                });
            });
        });

    });

    describe('Paws Get Register Parameters', function () {
        it('Paws Get Register Parameters Success', function (done) {
            setAlServiceStub();
            let ctx = {
                invokedFunctionArn: salesforceMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };

            SalesforceCollector.load().then(function (creds) {
                var collector = new SalesforceCollector(ctx, creds, 'salesforce');
                const sampleEvent = { ResourceProperties: { StackName: 'a-stack-name' } };
                collector.pawsGetRegisterParameters(sampleEvent, (err, regValues) => {
                    const expectedRegValues = {
                        salesforceUserID: 'salesforceUserID',
                        salesforceObjectNames: '["LoginHistory", "EventLogFile","ApiEvent", "LoginEvent", "LogoutEvent", "LoginAsEvent"]'
                    };
                    assert.deepEqual(regValues, expectedRegValues);
                    done();
                });
            });
        });
    });

    describe('pawsGetLogs', function () {
        let ctx = {
            invokedFunctionArn: salesforceMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        beforeEach(function(){
            setAlServiceStub();
        });
        it('Paws Get Logs Success', function (done) {

            getObjectLogs = sinon.stub(utils, 'getObjectLogs').callsFake(
                function fakeFn(response, objectQueryDetails, accumulator, state, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return resolve({ accumulator: [salesforceMock.LOG_EVENT, salesforceMock.LOG_EVENT] });
                    });
                });

            SalesforceCollector.load().then(function (creds) {
                var collector = new SalesforceCollector(ctx, creds, 'salesforce');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    object: "LoginHistory",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    poll_interval_sec: 1
                };

                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(logs.length, 2);
                    assert.equal(newState.poll_interval_sec, 1);
                    assert.ok(logs[0].attributes);
                    getObjectLogs.restore();
                    done();
                });

            });
        });

        it('Paws Get Logs Success when nextPage is not undefined', function (done) {

            getObjectLogs = sinon.stub(utils, 'getObjectLogs').callsFake(
                function fakeFn(response, objectQueryDetails, accumulator, state, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return resolve({ accumulator: [salesforceMock.LOG_EVENT, salesforceMock.LOG_EVENT], nextPage: null });
                    });
                });

            SalesforceCollector.load().then(function (creds) {
                var collector = new SalesforceCollector(ctx, creds, 'salesforce');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    object: "LoginHistory",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    poll_interval_sec: 1
                };

                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(logs.length, 2);
                    assert.equal(newState.poll_interval_sec, 1);
                    assert.ok(logs[0].attributes);
                    getObjectLogs.restore();
                    done();
                });

            });
        });

        it('Paws Get Logs with API Quota Reset Date', function (done) {

            getObjectLogs = sinon.stub(utils, 'getObjectLogs').callsFake(
                function fakeFn(response, objectQueryDetails, accumulator, state, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return resolve({ accumulator: [salesforceMock.LOG_EVENT, salesforceMock.LOG_EVENT] });
                    });
                });

            SalesforceCollector.load().then(function (creds) {
                var collector = new SalesforceCollector(ctx, creds, 'salesforce');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    object: "LoginHistory",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    apiQuotaResetDate: moment().add(25, 'hours').toISOString(),
                    poll_interval_sec: 900
                };

                var reportSpy = sinon.spy(collector, 'reportApiThrottling');

                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(true, reportSpy.calledOnce);
                    assert.equal(logs.length, 0);
                    assert.equal(newState.poll_interval_sec, 900);
                    getObjectLogs.restore();
                    done();
                });

            });
        });

        it('Paws Get Logs check throttling error', function (done) {

            getObjectLogs = sinon.stub(utils, 'getObjectLogs').callsFake(
                function fakeFn(response, objectQueryDetails, accumulator, state, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return reject({ errorCode: "REQUEST_LIMIT_EXCEEDED"  });
                    });
                });

            SalesforceCollector.load().then(function (creds) {
                var collector = new SalesforceCollector(ctx, creds, 'salesforce');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    object: "LoginHistory",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    poll_interval_sec: 1
                };

                var reportSpy = sinon.spy(collector, 'reportApiThrottling');

                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(true, reportSpy.calledOnce);
                    assert.equal(logs.length, 0);
                    assert.equal(newState.poll_interval_sec, 900);
                    getObjectLogs.restore();
                    done();
                });

            });
        });

        it('Paws Get Logs error when Error code is other than REQUEST_LIMIT_EXCEEDED', function (done) {

            getObjectLogs = sinon.stub(utils, 'getObjectLogs').callsFake(
                function fakeFn(response, objectQueryDetails, accumulator, state, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return reject({ errorCode: "Service Unavailable"  });
                    });
                });

            SalesforceCollector.load().then(function (creds) {
                var collector = new SalesforceCollector(ctx, creds, 'salesforce');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    object: "LoginHistory",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    poll_interval_sec: 1
                };
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.strictEqual(err.errorCode, 'Service Unavailable');
                    getObjectLogs.restore();
                    done();
                });

            });
        });

        it('Paws Get Logs error when Error code is INVALID_FIELD', function (done) {

            getObjectLogs = sinon.stub(utils, 'getObjectLogs').callsFake(
                function fakeFn(response, objectQueryDetails, accumulator, state, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return reject({ errorCode: "INVALID_FIELD"  });
                    });
                });

            SalesforceCollector.load().then(function (creds) {
                var collector = new SalesforceCollector(ctx, creds, 'salesforce');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    object: "LoginHistory",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    poll_interval_sec: 1
                };
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.strictEqual(err.errorCode, 'INVALID_FIELD');
                    getObjectLogs.restore();
                    done();
                });

            });
        });

        it('Paws Get Logs error when Error code is INVALID_TYPE', function (done) {

            getObjectLogs = sinon.stub(utils, 'getObjectLogs').callsFake(
                function fakeFn(response, objectQueryDetails, accumulator, state, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return reject({ errorCode: "INVALID_TYPE"  });
                    });
                });

            SalesforceCollector.load().then(function (creds) {
                var collector = new SalesforceCollector(ctx, creds, 'salesforce');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    object: "LoginHistory",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    poll_interval_sec: 1
                };
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.strictEqual(err.errorCode, 'INVALID_TYPE');
                    getObjectLogs.restore();
                    done();
                });

            });
        });

        it('Paws Get Logs error when Error code is INVALID_SESSION_ID', function (done) {

            getObjectLogs = sinon.stub(utils, 'getObjectLogs').callsFake(
                function fakeFn(response, objectQueryDetails, accumulator, state, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return reject({ errorCode: "INVALID_SESSION_ID"  });
                    });
                });

            SalesforceCollector.load().then(function (creds) {
                var collector = new SalesforceCollector(ctx, creds, 'salesforce');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    object: "LoginHistory",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    poll_interval_sec: 1
                };
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.strictEqual(err.errorCode, 'INVALID_SESSION_ID');
                    getObjectLogs.restore();
                    done();
                });

            });
        });


    });


    describe('Next state tests', function () {
        let ctx = {
            invokedFunctionArn: salesforceMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };

        beforeEach(function(){
            setAlServiceStub();
        });
        it('get next state if more than 24 hours in the past', function (done) {
            const startDate = moment().subtract(10, 'days');
            const curState = {
                since: startDate.toISOString(),
                until: startDate.add(5, 'days').toISOString(),
                poll_interval_sec: 1
            };
            SalesforceCollector.load().then(function (creds) {
                var collector = new SalesforceCollector(ctx, creds, 'salesforce');
                const newState = collector._getNextCollectionState(curState);
                assert.equal(moment(newState.until).diff(newState.since, 'hours'), 24);
                assert.equal(newState.poll_interval_sec, 1);
                done();
            });
        });


        it('get next state if more than 1 hours in the past', function (done) {
            const startDate = moment().subtract(5, 'hours');
            const curState = {
                since: startDate.toISOString(),
                until: startDate.add(3, 'hours').toISOString(),
                poll_interval_sec: 1
            };
            SalesforceCollector.load().then(function (creds) {
                var collector = new SalesforceCollector(ctx, creds, 'salesforce');
                const newState = collector._getNextCollectionState(curState);
                assert.equal(moment(newState.until).diff(newState.since, 'hours'), 1);
                assert.equal(newState.poll_interval_sec, 1);
                done();
            });
        });


        it('get next state if less than 1 hour in the past but more than the polling interval', function (done) {
            const startDate = moment().subtract(20, 'minutes');
            SalesforceCollector.load().then(function (creds) {
                var collector = new SalesforceCollector(ctx, creds, 'salesforce');
                const curState = {
                    since: startDate.toISOString(),
                    until: startDate.add(collector.pollInterval, 'seconds').toISOString(),
                    poll_interval_sec: 1
                };
                const newState = collector._getNextCollectionState(curState);
                assert.equal(moment(newState.until).diff(newState.since, 'seconds'), collector.pollInterval);
                assert.equal(newState.poll_interval_sec, 1);
                done();
            });
        });

        it('get next state if within polling interval', function (done) {
            SalesforceCollector.load().then(function (creds) {
                var collector = new SalesforceCollector(ctx, creds, 'salesforce');
                const startDate = moment().subtract(collector.pollInterval * 2, 'seconds');
                const curState = {
                    since: startDate.toISOString(),
                    until: startDate.add(collector.pollInterval, 'seconds').toISOString(),
                    poll_interval_sec: 1
                };
                const newState = collector._getNextCollectionState(curState);
                assert.equal(moment(newState.until).diff(newState.since, 'seconds'), collector.pollInterval);
                assert.equal(newState.poll_interval_sec, collector.pollInterval);
                done();
            });
        });
    });

    describe('Format Tests', function () {
        it('log format success', function (done) {
            setAlServiceStub();
            let ctx = {
                invokedFunctionArn: salesforceMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };

            SalesforceCollector.load().then(function (creds) {
                var collector = new SalesforceCollector(ctx, creds, 'salesforce');
                collector.tsPaths = [{ path: ["LastLoginDate"] }];
                let fmt = collector.pawsFormatLog(salesforceMock.LOG_EVENT);
                assert.equal(fmt.progName, 'SalesforceCollector');
                assert.ok(fmt.messageType);
                done();
            });
        });
        it('log format when type is null or undefined', function (done) {
            setAlServiceStub();
            let ctx = {
                invokedFunctionArn: salesforceMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };

            SalesforceCollector.load().then(function (creds) {
                var collector = new SalesforceCollector(ctx, creds, 'salesforce');
                collector.tsPaths = [{ path: ["LastLoginDate"] }];
                salesforceMock.LOG_EVENT.attributes = null;
                let fmt = collector.pawsFormatLog(salesforceMock.LOG_EVENT);
                assert.equal(fmt.messageTypeId, undefined);
                done();
            });
        });
    });


    describe('NextCollectionStateWithNextPage', function () {
        it('Get Next Collection State With NextPage Success', function (done) {
            setAlServiceStub();
            let ctx = {
                invokedFunctionArn: salesforceMock.FUNCTION_ARN,
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
                object: "LoginHistory",
                since: startDate.toISOString(),
                until: startDate.add(5, 'minutes').toISOString(),
                poll_interval_sec: 1
            };
            const nextPage = "lastValue";
            SalesforceCollector.load().then(function (creds) {
                var collector = new SalesforceCollector(ctx, creds, 'salesforce');
                let nextState = collector._getNextCollectionStateWithNextPage(curState, nextPage);
                assert.ok(nextState.since);
                done();
            });
        });
    });

    describe('Paws Get Logs check  errors',function(){
       
        it('Paws Get Logs check Client error', function (done) {

            let ctx = {
                invokedFunctionArn: salesforceMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };
            token = sinon.stub(jwt, 'sign').callsFake(
                function fakeFn(path) {
                    return {};
                });
        
            requestPost = sinon.stub(RestServiceClient.prototype, 'post').callsFake(
                function fakeFn(path, extraOptions) {
                    return new Promise(function (resolve, reject) {
                        return reject({statusCode:400,error:{
                            error : "invalid_client_id",
                            error_description: 'client identifier invalid'
                        }  });
                    });
                });
        
            getObjectQuery = sinon.stub(utils, 'getObjectQuery').callsFake(
                function fakeFn(state) {
                    return {
                        query: "query",
                        tsPaths: [{ path: ["LastLoginDate"] }],
                        sortFieldName: "sortFieldName",
                        sortType: "sortType"
                    };
                });
            getObjectLogs = sinon.stub(utils, 'getObjectLogs').callsFake(
                function fakeFn(response, objectQueryDetails, accumulator, state, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return reject({ errorCode: "invalid_client_id"  });
                    });
                });

            SalesforceCollector.load().then(function (creds) {
                var collector = new SalesforceCollector(ctx, creds, 'salesforce');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    object: "LoginHistory",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    poll_interval_sec: 1
                };

                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.strictEqual(err.errorCode, 'invalid_client_id');
                    getObjectLogs.restore();
                    done();
                });

            });
        });
    });
});
