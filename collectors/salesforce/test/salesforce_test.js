const assert = require('assert');
const sinon = require('sinon');
const m_response = require('@alertlogic/al-aws-collector-js').CfnResponse;
const salesforceMock = require('./salesforce_mock');
var SalesforceCollector = require('../collector').SalesforceCollector;
const moment = require('moment');
const utils = require("../utils");
var jwt = require('jsonwebtoken');
const RestServiceClient = require('@alertlogic/al-collector-js').RestServiceClient;
const { CloudWatch } = require("@aws-sdk/client-cloudwatch"),
    { KMS } = require("@aws-sdk/client-kms"),
    { SSM } = require("@aws-sdk/client-ssm");

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
    if (token && token.restore) {
        token.restore();
    }
    if (requestPost && requestPost.restore) {
        requestPost.restore();
    }
    if (getObjectQuery && getObjectQuery.restore) {
        getObjectQuery.restore();
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
        restoreAlServiceStub();
        responseStub.restore();
        KMS.prototype.decrypt.restore();
        SSM.prototype.getParameter.restore();
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
        it('get inital state less than 7 days in the past', async function () {
            const creds = await SalesforceCollector.load();
            var collector = new SalesforceCollector(ctx, creds, 'salesforce');
            const startDate = moment().subtract(1, 'days').toISOString();
            process.env.paws_collection_start_ts = startDate;

            const { state: initialStates } = await collector.pawsInitCollectionState(null);
            initialStates.forEach((collectionState) => {
                assert.equal(collectionState.since, startDate, "Dates are not equal");
                assert.notEqual(moment(collectionState.until).diff(collectionState.since, 'hours'), 24);
            });
        });
        it('get inital state less than 24 hours in the past', async function () {
            const creds = await SalesforceCollector.load();
            var collector = new SalesforceCollector(ctx, creds, 'salesforce');
            const startDate = moment().subtract(12, 'hours').toISOString();
            process.env.paws_collection_start_ts = startDate;

            const { state: initialStates } = await collector.pawsInitCollectionState(null);
            initialStates.forEach((collectionState) => {
                assert.notEqual(moment(collectionState.until).diff(collectionState.since, 'hours'), 24);
            });
        });

    });

    describe('Paws Get Register Parameters', function () {
        it('Paws Get Register Parameters Success', async function () {
            setAlServiceStub();
            let ctx = {
                invokedFunctionArn: salesforceMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                },
                succeed: function () {}
            };

            const creds = await SalesforceCollector.load();
            var collector = new SalesforceCollector(ctx, creds, 'salesforce');
            const sampleEvent = { ResourceProperties: { StackName: 'a-stack-name' } };
            const regValues = await collector.pawsGetRegisterParameters(sampleEvent);
            const expectedRegValues = {
                salesforceUserID: 'salesforceUserID',
                salesforceObjectNames: '["LoginHistory", "EventLogFile","ApiEvent", "LoginEvent", "LogoutEvent", "LoginAsEvent"]'
            };
            assert.deepEqual(regValues, expectedRegValues);
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
        it('Paws Get Logs Success', async function () {

            getObjectLogs = sinon.stub(utils, 'getObjectLogs').callsFake(
                function fakeFn(response, objectQueryDetails, accumulator, state, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return resolve({ accumulator: [salesforceMock.LOG_EVENT, salesforceMock.LOG_EVENT] });
                    });
                });
            try {
                const creds = await SalesforceCollector.load();
                var collector = new SalesforceCollector(ctx, creds, 'salesforce');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    object: "LoginHistory",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    poll_interval_sec: 1
                };

                const [logs, newState] = await collector.pawsGetLogs(curState);
                assert.equal(logs.length, 2);
                assert.equal(newState.poll_interval_sec, 1);
                assert.ok(logs[0].attributes);
            } finally {
                getObjectLogs.restore();
            }
        });

        it('Paws Get Logs with API Quota Reset Date', async function () {

            getObjectLogs = sinon.stub(utils, 'getObjectLogs').callsFake(
                function fakeFn(response, objectQueryDetails, accumulator, state, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return resolve({ accumulator: [salesforceMock.LOG_EVENT, salesforceMock.LOG_EVENT] });
                    });
                });
            let putMetricDataStub;
            try {
                const creds = await SalesforceCollector.load();
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
                putMetricDataStub = sinon.stub(CloudWatch.prototype, 'putMetricData').callsFake((params) => Promise.resolve());
                const [logs, newState] = await collector.pawsGetLogs(curState);
                assert.equal(true, reportSpy.calledOnce);
                assert.equal(logs.length, 0);
                assert.equal(newState.poll_interval_sec, 900);
            } finally {
                getObjectLogs.restore();
                if (putMetricDataStub && putMetricDataStub.restore) {
                    putMetricDataStub.restore();
                }
            }
        });

        it('Paws Get Logs check throttling error', async function () {

            getObjectLogs = sinon.stub(utils, 'getObjectLogs').callsFake(
                function fakeFn(response, objectQueryDetails, accumulator, state, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return reject({ errorCode: "REQUEST_LIMIT_EXCEEDED"  });
                    });
                });
            let putMetricDataStub;
            try {
                const creds = await SalesforceCollector.load();
                var collector = new SalesforceCollector(ctx, creds, 'salesforce');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    object: "LoginHistory",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    poll_interval_sec: 1
                };

                var reportSpy = sinon.spy(collector, 'reportApiThrottling');
                putMetricDataStub = sinon.stub(CloudWatch.prototype, 'putMetricData').callsFake((params) => Promise.resolve());
                const [logs, newState] = await collector.pawsGetLogs(curState);
                assert.equal(true, reportSpy.calledOnce);
                assert.equal(logs.length, 0);
                assert.equal(newState.poll_interval_sec, 900);
            } finally {
                getObjectLogs.restore();
                if (putMetricDataStub && putMetricDataStub.restore) {
                    putMetricDataStub.restore();
                }
            }
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
        it('get next state if more than 24 hours in the past', async function () {
            const startDate = moment().subtract(10, 'days');
            const curState = {
                since: startDate.toISOString(),
                until: startDate.add(5, 'days').toISOString(),
                poll_interval_sec: 1
            };
            const creds = await SalesforceCollector.load();
            var collector = new SalesforceCollector(ctx, creds, 'salesforce');
            const newState = collector._getNextCollectionState(curState);
            assert.equal(moment(newState.until).diff(newState.since, 'hours'), 24);
            assert.equal(newState.poll_interval_sec, 1);
        });


        it('get next state if more than 1 hours in the past', async function () {
            const startDate = moment().subtract(5, 'hours');
            const curState = {
                since: startDate.toISOString(),
                until: startDate.add(3, 'hours').toISOString(),
                poll_interval_sec: 1
            };
            const creds = await SalesforceCollector.load();
            var collector = new SalesforceCollector(ctx, creds, 'salesforce');
            const newState = collector._getNextCollectionState(curState);
            assert.equal(moment(newState.until).diff(newState.since, 'hours'), 1);
            assert.equal(newState.poll_interval_sec, 1);
        });


        it('get next state if less than 1 hour in the past but more than the polling interval', async function () {
            const startDate = moment().subtract(20, 'minutes');
            const creds = await SalesforceCollector.load();
            var collector = new SalesforceCollector(ctx, creds, 'salesforce');
            const curState = {
                since: startDate.toISOString(),
                until: startDate.add(collector.pollInterval, 'seconds').toISOString(),
                poll_interval_sec: 1
            };
            const newState = collector._getNextCollectionState(curState);
            assert.equal(moment(newState.until).diff(newState.since, 'seconds'), collector.pollInterval);
            assert.equal(newState.poll_interval_sec, 1);
        });

        it('get next state if within polling interval', async function () {
            const creds = await SalesforceCollector.load();
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
        });
    });

    describe('Format Tests', function () {
        it('log format success', async function () {
            setAlServiceStub();
            let ctx = {
                invokedFunctionArn: salesforceMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                },
                succeed: function () {}
            };

            const creds = await SalesforceCollector.load();
            var collector = new SalesforceCollector(ctx, creds, 'salesforce');
            collector.tsPaths = [{ path: ["LastLoginDate"] }];
            let fmt = collector.pawsFormatLog(salesforceMock.LOG_EVENT);
            assert.equal(fmt.progName, 'SalesforceCollector');
            assert.ok(fmt.messageType);
        });
    });


    describe('NextCollectionStateWithNextPage', function () {
        it('Get Next Collection State With NextPage Success', async function () {
            setAlServiceStub();
            let ctx = {
                invokedFunctionArn: salesforceMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                },
                succeed: function () {}
            };

            const startDate = moment().subtract(5, 'minutes');
            const curState = {
                object: "LoginHistory",
                since: startDate.toISOString(),
                until: startDate.add(5, 'minutes').toISOString(),
                poll_interval_sec: 1
            };
            const nextPage = "lastValue";
            const creds = await SalesforceCollector.load();
            var collector = new SalesforceCollector(ctx, creds, 'salesforce');
            let nextState = collector._getNextCollectionStateWithNextPage(curState, nextPage);
            assert.ok(nextState.since);
        });
    });

    describe('Paws Get Logs check  errors',function(){
       
        it('Paws Get Logs check Client error', async function () {

            let ctx = {
                invokedFunctionArn: salesforceMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                },
                succeed: function () {}
            };
            token = sinon.stub(jwt, 'sign').callsFake(
                function fakeFn(path) {
                    return {};
                });
        
            requestPost = sinon.stub(RestServiceClient.prototype, 'post').callsFake(
                function fakeFn(path, extraOptions) {
                    return new Promise(function (resolve, reject) {
                        return reject({
                            response: {
                                data: { error: "invalid_client_id", error_description: "client identifier invalid" }
                            }
                        });
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

            try {
                const creds = await SalesforceCollector.load();
                var collector = new SalesforceCollector(ctx, creds, 'salesforce');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    object: "LoginHistory",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    poll_interval_sec: 1
                };

                await assert.rejects(
                    async () => collector.pawsGetLogs(curState),
                    (err) => {
                        assert.strictEqual(err.errorCode, 'invalid_client_id');
                        return true;
                    }
                );
            } finally {
                getObjectLogs.restore();
            }
        });

        it('Paws Get Logs maps token error status to errorCode', async function () {
            let ctx = {
                invokedFunctionArn: salesforceMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                },
                succeed: function () {}
            };

            token = sinon.stub(jwt, 'sign').callsFake(
                function fakeFn(path) {
                    return {};
                });

            requestPost = sinon.stub(RestServiceClient.prototype, 'post').callsFake(
                function fakeFn(path, extraOptions) {
                    return Promise.reject({
                        response: {
                            status: 401
                        }
                    });
                });

            try {
                const creds = await SalesforceCollector.load();
                var collector = new SalesforceCollector(ctx, creds, 'salesforce');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    object: "LoginHistory",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    poll_interval_sec: 1
                };

                await assert.rejects(
                    async () => collector.pawsGetLogs(curState),
                    (err) => {
                        assert.strictEqual(err.errorCode, 401);
                        return true;
                    }
                );
            } finally {
                requestPost.restore();
                token.restore();
            }
        });
    });
});
