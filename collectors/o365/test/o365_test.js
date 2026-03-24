const assert = require('assert');
const sinon = require('sinon');
const moment = require('moment');
const m_response = require('@alertlogic/al-aws-collector-js').CfnResponse;

const o365Mock = require('./o365_mock');
var m_alCollector = require('@alertlogic/al-collector-js');
const { checkO365Subscriptions } = require('../healthcheck.js');
var O365Collector = require('../o365_collector').O365Collector;
const m_al_aws = require('@alertlogic/al-aws-collector-js');
const { DynamoDB } = require("@aws-sdk/client-dynamodb"),
    { KMS } = require("@aws-sdk/client-kms"),
    { SSM } = require("@aws-sdk/client-ssm");


var alserviceStub = {};
var responseStub = {};
var setEnvStub = {};
var subscriptionsContentStub;
var listSubscriptionsStub;
var startSubscriptionStub;
var getPreFormedUrlStub;

function setAlServiceStub() {
    alserviceStub.get = sinon.stub(m_alCollector.AlServiceC.prototype, 'get').callsFake(
        function fakeFn(path, extraOptions) {
            return new Promise(function (resolve, reject) {
                var ret = null;
                switch (path) {
                    case '/residency/default/services/ingest/endpoint':
                        ret = {
                            ingest: 'new-ingest-endpoint'
                        };
                        break;
                    case '/residency/default/services/azcollect/endpoint':
                        ret = {
                            azcollect: 'new-azcollect-endpoint'
                        };
                        break;
                    default:
                        break;
                }
                return resolve(ret);
            });
        });
    alserviceStub.post = sinon.stub(m_alCollector.AlServiceC.prototype, 'post').callsFake(
        function fakeFn(path, extraOptions) {
            return new Promise(function (resolve, reject) {
                return resolve();
            });
        });
    alserviceStub.del = sinon.stub(m_alCollector.AlServiceC.prototype, 'deleteRequest').callsFake(
        function fakeFn(path) {
            return new Promise(function (resolve, reject) {
                return resolve();
            });
        });
}

function restoreAlServiceStub() {
    alserviceStub.get.restore();
    alserviceStub.post.restore();
    alserviceStub.del.restore();
}

function setO365MangementStub(m_o365mgmnt) {
    listSubscriptionsStub = sinon.stub(m_o365mgmnt, 'listSubscriptions').callsFake(
        function fakeFn(extraOptions) {
            return new Promise(function (resolve, reject) {
                var result = [
                    {
                        contentType: 'Audit.Exchange',
                        status: 'enabled',
                        webhook: null
                    },
                    {
                        contentType: 'Audit.General',
                        status: 'enabled',
                        webhook: null
                    }
                ];
                return resolve({
                    nextPageUri: undefined,
                    parsedBody: result
                });
            });
        });
    startSubscriptionStub = sinon.stub(m_o365mgmnt, 'startSubscription').callsFake(
        function fakeFn(stream, extraOptions) {
            return new Promise(function (resolve, reject) {
                var result = {
                    contentType: stream,
                    status: 'enabled',
                    webhook: null
                };
                return resolve({
                    nextPageUri: undefined,
                    parsedBody: result
                });
            });
        });
    subscriptionsContentStub = sinon.stub(m_o365mgmnt, 'subscriptionsContent').callsFake(
        function fakeFn(contentType, startTs, endTs, options) {
            return new Promise(function (resolve, reject) {
                var result = {
                    contentUri: "https://joeiscool.com/joeiscool"
                };
                return resolve({
                    nextPageUri: undefined,
                    parsedBody: [result]
                });
            });
        });
    getPreFormedUrlStub = sinon.stub(m_o365mgmnt, 'getPreFormedUrl').callsFake(
        function fakeFn(path, extraOptions) {
            return new Promise(function (resolve, reject) {
                return resolve({
                    nextPageUri: undefined,
                    parsedBody: [o365Mock.MOCK_LOG]
                });
            });
        });
}

function restoreO365ManagemntStub() {
    listSubscriptionsStub.restore();
    startSubscriptionStub.restore();
    subscriptionsContentStub.restore();
    getPreFormedUrlStub.restore();
}
function mockSetEnvStub() {
    setEnvStub = sinon.stub(m_al_aws.AlAwsCommon, 'setEnvAsync').callsFake((vars) => {
        const {
            ingest_api,
            azcollect_api,
            collector_status_api
        } = vars;
        process.env.ingest_api = ingest_api ? ingest_api : process.env.ingest_api;
        process.env.azcollect_api = azcollect_api ? azcollect_api : process.env.azcollect_api;
        process.env.collector_status_api = collector_status_api ? collector_status_api : process.env.collector_status_api;
        const returnBody = {
            Environment: {
                Variables: vars
            }
        };
        return Promise.resolve(returnBody);
    });
}

describe('O365 Collector Tests', function () {

    beforeEach(function () {
        sinon.stub(KMS.prototype, 'decrypt').callsFake(function (params) {
            const data = {
                Plaintext: Buffer.from('decrypted-aims-sercret-key')
            };
            return Promise.resolve(data);
        });

        sinon.stub(SSM.prototype, 'getParameter').callsFake(function (params) {
            const data = process.env.ssm_direct ? 'test-secret-key' : Buffer.from('test-secret-key');
            return Promise.resolve({ Parameter: { Value: process.env.ssm_direct ? data : data.toString('base64') } });
        });

        responseStub = sinon.stub(m_response, 'send').callsFake(
            function fakeFn(event, mockContext, responseStatus, responseData, physicalResourceId) {
                return Promise.resolve();
            });

        setAlServiceStub();
        mockSetEnvStub();
    });

    afterEach(function () {
        restoreAlServiceStub();
        setEnvStub.restore();
        responseStub.restore();
        KMS.prototype.decrypt.restore();
        SSM.prototype.getParameter.restore();
    });

    describe('healthcheck', function () {
        let ctx = {
            invokedFunctionArn: o365Mock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };

        it('does not start subscriptions when streams are enabled', async function () {
            const creds = await O365Collector.load();
            var collector = new O365Collector(ctx, creds);
            setO365MangementStub(collector.o365_mgmnt_client);
            const tempStreams = process.env.collector_streams;
            process.env.collector_streams = "[\"Audit.Exchange\", \"Audit.General\"]";
            const checkSubscriptions = checkO365Subscriptions.bind(collector);
            await checkSubscriptions();
            assert.equal(startSubscriptionStub.called, false);
            restoreO365ManagemntStub();
            process.env.collector_streams = tempStreams;
        });

        it('starts subscriptions when streams are not enabled', async function () {
            const creds = await O365Collector.load();
            var collector = new O365Collector(ctx, creds);
            setO365MangementStub(collector.o365_mgmnt_client);
            const tempStreams = process.env.collector_streams;
            process.env.collector_streams = "[\"Audit.Exchange\", \"Audit.Sharepoint\", \"Audit.General\"]";
            const checkSubscriptions = checkO365Subscriptions.bind(collector);
            await checkSubscriptions();
            assert.equal(startSubscriptionStub.called, true);
            restoreO365ManagemntStub();
            process.env.collector_streams = tempStreams;
        });
    });

    describe('pawsInitCollectionState', function () {
        let ctx = {
            invokedFunctionArn: o365Mock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('get inital state less than 7 days in the past', async function () {
            const creds = await O365Collector.load();
            var collector = new O365Collector(ctx, creds);
            const startDate = moment().subtract(1, 'days').toISOString();
            process.env.paws_collection_start_ts = startDate;
            setO365MangementStub(collector.o365_mgmnt_client);

            const { state } = await collector.pawsInitCollectionState(o365Mock.LOG_EVENT);
            state.forEach((eachStreamState) => {
                assert.equal(eachStreamState.since, startDate, "Dates are equal");
                assert.notEqual(moment(eachStreamState.until).diff(eachStreamState.since, 'hours'), 24);
            });
        });
        it('get inital state more than 7 days in the past', async function () {
            const creds = await O365Collector.load();
            var collector = new O365Collector(ctx, creds, 'o365');
            setO365MangementStub(collector.o365_mgmnt_client);
            const startDate = moment().subtract(8, 'days').toISOString();
            process.env.paws_collection_start_ts = startDate;

            const { state } = await collector.pawsInitCollectionState(o365Mock.LOG_EVENT);
            state.forEach((eachStreamState) => {
                assert.notEqual(eachStreamState.since, startDate, "Date is more than 7 days in the past");
                assert.equal(moment(eachStreamState.until).diff(eachStreamState.since, 'hours'), 1);
            });
        });
        it('get inital state less than 24 hours in the past', async function () {
            const creds = await O365Collector.load();
            var collector = new O365Collector(ctx, creds, 'o365');
            setO365MangementStub(collector.o365_mgmnt_client);
            const startDate = moment().subtract(12, 'hours').toISOString();
            process.env.paws_collection_start_ts = startDate;

            const { state } = await collector.pawsInitCollectionState(o365Mock.LOG_EVENT);
            state.forEach((eachStreamState) => {
                assert.notEqual(moment(eachStreamState.until).diff(eachStreamState.since, 'hours'), 24);
            });
        });
        it('get inital state more than 7 days in the past', async function () {
            const creds = await O365Collector.load();
            var collector = new O365Collector(ctx, creds, 'o365');
            setO365MangementStub(collector.o365_mgmnt_client);
            const startDate = moment().subtract(2, 'days').toISOString();
            process.env.paws_collection_start_ts = startDate;

            const { state } = await collector.pawsInitCollectionState(o365Mock.LOG_EVENT);
            state.forEach((eachStreamState) => {
                assert.equal(moment(eachStreamState.until).diff(eachStreamState.since, 'hours'), 1);
            });
        });
    });

    describe('_getNextCollectionState', function () {
        let ctx = {
            invokedFunctionArn: o365Mock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('get next state if more than 24 hours in the past', async function () {
            const startDate = moment().subtract(3, 'days');
            const curState = {
                since: startDate.toISOString(),
                until: startDate.add(2, 'days').toISOString(),
                poll_interval_sec: 1
            };
            const creds = await O365Collector.load();
            var collector = new O365Collector(ctx, creds);
            const newState = collector._getNextCollectionState(curState);
            assert.equal(moment(newState.until).diff(newState.since, 'hours'), 1);
            assert.equal(newState.poll_interval_sec, 1);
        });
        it('get next state if less than 24 hours in the past but more than an hour', async function () {
            const startDate = moment().subtract(3, 'hours');
            const curState = {
                since: startDate.toISOString(),
                until: startDate.add(1, 'hours').toISOString(),
                poll_interval_sec: 1
            };
            const creds = await O365Collector.load();
            var collector = new O365Collector(ctx, creds, 'o365');
            const newState = collector._getNextCollectionState(curState);
            assert.equal(moment(newState.until).diff(newState.since, 'hours'), 1);
            assert.equal(newState.poll_interval_sec, 1);
        });
        it('get next state if less than 1 hour in the past but more than the polling interval', async function () {
            const startDate = moment().subtract(20, 'minutes');
            const creds = await O365Collector.load();
            var collector = new O365Collector(ctx, creds, 'o365');
            const curState = {
                since: startDate.toISOString(),
                until: startDate.add(collector.pollInterval, 'seconds').toISOString(),
                poll_interval_sec: 1
            };
            const newState = collector._getNextCollectionState(curState);
            assert.equal(moment(newState.until).diff(newState.since, 'seconds'), collector.pollInterval);
            assert.equal(newState.poll_interval_sec, 1);
        });
        it('get next state if more than 7 days in the past', async function () {
            const startDate = moment().subtract(8, 'day');
            const curState = {
                since: startDate.toISOString(),
                until: startDate.add(1, 'days').toISOString(),
                poll_interval_sec: 1
            };
            const creds = await O365Collector.load();
            var collector = new O365Collector(ctx, creds, 'o365');
            const newState = collector._getNextCollectionState(curState);
            assert.equal(moment(newState.until).diff(newState.since, 'hours'), 1);
            assert.equal(newState.poll_interval_sec, 1);
        });

        it('get next state if within polling interval', async function () {
            const creds = await O365Collector.load();
            var collector = new O365Collector(ctx, creds, 'o365');
            const startDate = moment().subtract(collector.pollInterval * 2, 'seconds');
            const curState = {
                since: startDate.toISOString(),
                until: startDate.add(collector.pollInterval, 'seconds').toISOString(),
                poll_interval_sec: 1
            };
            const newState = collector._getNextCollectionState(curState);
            assert.equal(moment(newState.until).diff(newState.since, 'seconds'), collector.pollInterval);
            assert.equal(newState.poll_interval_sec, process.env.paws_poll_interval_delay);
        });
    });

    describe('pawsGetLogs', function () {
        beforeEach(function () {
            const putItemStub = sinon.stub().callsFake(
                function (_params) {
                    return Promise.resolve({ data: null });
                });
            sinon.stub(DynamoDB.prototype, 'putItem').callsFake(putItemStub);
        });
        afterEach(function () {
            DynamoDB.prototype.putItem.restore();
        });
        let ctx = {
            invokedFunctionArn: o365Mock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };

        it('Updates a stale state', async function () {
            const creds = await O365Collector.load();
            var collector = new O365Collector(ctx, creds);
            setO365MangementStub(collector.o365_mgmnt_client);
            const startDate = moment().subtract(10, 'days');
            const curState = {
                stream: "FakeStream",
                since: startDate.toISOString(),
                until: startDate.add(1, 'days').toISOString(),
                poll_interval_sec: 1
            };

            const [logs] = await collector.pawsGetLogs(curState);
            const callArgs = subscriptionsContentStub.getCall(0).args;
            assert.equal(callArgs[0], curState.stream);
            assert.equal(moment().diff(callArgs[1], 'hours'), 167);
            assert.equal(moment(callArgs[2]).diff(callArgs[1], 'hours'), 1);
            assert.equal(logs.length, 1);
            restoreO365ManagemntStub();
        });

        it('Updates a stale state with next page', async function () {
            const creds = await O365Collector.load();
            var collector = new O365Collector(ctx, creds);
            setO365MangementStub(collector.o365_mgmnt_client);
            const startDate = moment().subtract(10, 'days');
            const curState = {
                stream: "FakeStream",
                since: startDate.toISOString(),
                until: startDate.add(1, 'days').toISOString(),
                nextPage: 'https://www.joecantprogram.com?nextpagetoken=8675309',
                poll_interval_sec: 1
            };

            await collector.pawsGetLogs(curState);
            const callArgs = subscriptionsContentStub.getCall(0).args;
            assert.equal(callArgs[0], curState.stream);
            assert.equal(moment().diff(callArgs[1], 'hours'), 167);
            assert.equal(moment(callArgs[2]).diff(callArgs[1], 'hours'), 1);
            assert.equal(getPreFormedUrlStub.calledWith(curState.nextPage), false);
            restoreO365ManagemntStub();
        });

        it('check if state moment is null or blank', async function () {
            const creds = await O365Collector.load();
            var collector = new O365Collector(ctx, creds);
            setO365MangementStub(collector.o365_mgmnt_client);
            const curState = {
                stream: "FakeStream",
                since: "",
                until: null,
                poll_interval_sec: 1
            };

            const [logs, newState] = await collector.pawsGetLogs(curState);
            assert.equal(logs.length, 0);
            assert.equal(moment(newState.until).diff(newState.since, 'seconds'), collector.pollInterval);
            assert.equal(newState.poll_interval_sec, process.env.paws_poll_interval_delay);
            restoreO365ManagemntStub();
        });

        it('check if since and until are undefined', async function () {
            const creds = await O365Collector.load();
            var collector = new O365Collector(ctx, creds, 'o365');
            setO365MangementStub(collector.o365_mgmnt_client);
            const curState = {
                stream: "FakeStream",
                since: undefined,
                until: undefined,
                poll_interval_sec: 1
            };

            const [logs, newState] = await collector.pawsGetLogs(curState);
            assert.equal(logs.length, 0);
            assert.equal(moment(newState.until).diff(newState.since, 'seconds'), collector.pollInterval);
            assert.equal(newState.poll_interval_sec, process.env.paws_poll_interval_delay);
            restoreO365ManagemntStub();
        });

        it('Get Logs Sunny', async function () {
            const creds = await O365Collector.load();
            var collector = new O365Collector(ctx, creds, 'o365');
            setO365MangementStub(collector.o365_mgmnt_client);
            const startDate = moment().subtract(3, 'days');
            const curState = {
                stream: "FakeStream",
                since: startDate.toISOString(),
                until: startDate.add(2, 'days').toISOString(),
                poll_interval_sec: 1
            };

            const [logs, newState] = await collector.pawsGetLogs(curState);
            assert.equal(logs.length, 1);
            assert.equal(moment(newState.until).diff(newState.since, 'hours'), 1);
            assert.equal(newState.poll_interval_sec, 1);
            restoreO365ManagemntStub();
        });

        it('Get Logs Cloudy', async function () {
            const creds = await O365Collector.load();
            var collector = new O365Collector(ctx, creds);
            subscriptionsContentStub = sinon.stub(collector.o365_mgmnt_client, 'subscriptionsContent').callsFake(
                function fakeFn(contentType, startTs, endTs, options) {
                    return new Promise(function (resolve, reject) {
                        return reject(new Error('Here is an Error'));
                    });
                });
            getPreFormedUrlStub = sinon.stub(collector.o365_mgmnt_client, 'getPreFormedUrl').callsFake(
                function fakeFn(path, extraOptions) {
                    return new Promise(function (resolve, reject) {
                        return resolve({ parsedBody: [o365Mock.MOCK_LOG] });
                    });
                });
            const startDate = moment().subtract(3, 'days');
            const curState = {
                since: startDate.toISOString(),
                until: startDate.add(2, 'days').toISOString(),
                poll_interval_sec: 1
            };
            try {
                await collector.pawsGetLogs(curState);
            } catch (error) {
                assert.equal(error.message, 'Here is an Error');
                restoreO365ManagemntStub();
            }
        });
        it('Get next content page when present', async function () {
            const creds = await O365Collector.load();
            var collector = new O365Collector(ctx, creds, 'o365');

            subscriptionsContentStub = sinon.stub(collector.o365_mgmnt_client, 'subscriptionsContent').callsFake(
                function fakeFn(contentType, startTs, endTs, options) {
                    return new Promise(function (resolve, reject) {
                        var result = {
                            contentUri: "https://joeiscool.com/joeiscool"
                        };
                        return resolve({
                            nextPageUri: 'a fake next page',
                            parsedBody: [result]
                        });
                    });
                });
            getPreFormedUrlStub = sinon.stub(collector.o365_mgmnt_client, 'getPreFormedUrl');
            getPreFormedUrlStub.onCall(0).callsFake(
                function (path, extraOptions) {
                    return new Promise(function (resolve, reject) {
                        var result = {
                            contentUri: "https://joeiscool.com/nextpage"
                        };
                        return resolve({
                            nextPageUri: undefined,
                            parsedBody: [result]
                        });
                    });
                });
            getPreFormedUrlStub.onCall(1).callsFake(
                function (path, extraOptions) {
                    return new Promise(function (resolve, reject) {
                        var result = {
                            aLogKey: "SomeLogValue1"
                        };
                        return resolve({
                            nextPageUri: undefined,
                            parsedBody: [result]
                        });
                    });
                });
            getPreFormedUrlStub.onCall(2).callsFake(
                function (path, extraOptions) {
                    return new Promise(function (resolve, reject) {
                        var result = {
                            aLogKey: "SomeLogValue2"
                        };
                        return resolve({
                            nextPageUri: undefined,
                            parsedBody: [result]
                        });
                    });
                });
            const startDate = moment().subtract(3, 'days');
            const curState = {
                stream: "FakeStream",
                since: startDate.toISOString(),
                until: startDate.add(2, 'days').toISOString(),
                poll_interval_sec: 1
            };

            const [logs] = await collector.pawsGetLogs(curState);
            assert.ok(getPreFormedUrlStub.calledWith('https://joeiscool.com/joeiscool'));
            assert.equal(logs.length, 2);
            restoreO365ManagemntStub();
        });

        it('Stops paginiating at the pagination limit', async function () {
            const creds = await O365Collector.load();
            var collector = new O365Collector(ctx, creds, 'o365');
            subscriptionsContentStub = sinon.stub(collector.o365_mgmnt_client, 'subscriptionsContent').callsFake(
                function fakeFn(contentType, startTs, endTs, options) {
                    return new Promise(function (resolve, reject) {
                        var result = {
                            contentUri: "https://joeiscool.com/joeiscool"
                        };
                        return resolve({
                            nextPageUri: 'a fake next page',
                            parsedBody: [result]
                        });
                    });
                });
            getPreFormedUrlStub = sinon.stub(collector.o365_mgmnt_client, 'getPreFormedUrl').callsFake(
                function (path, extraOptions) {
                    return new Promise(function (resolve, reject) {
                        var result = {
                            contentUri: "https://joeiscool.com/nextpage"
                        };
                        return resolve({
                            nextPageUri: 'a fake next page',
                            parsedBody: [result]
                        });
                    });
                });
            const startDate = moment().subtract(3, 'days');
            const curState = {
                stream: "FakeStream",
                since: startDate.toISOString(),
                until: startDate.add(2, 'days').toISOString(),
                poll_interval_sec: 1
            };

            const [logs, newState] = await collector.pawsGetLogs(curState);
            assert.ok(getPreFormedUrlStub.getCall(0).calledWithExactly('a fake next page'));
            assert.ok(getPreFormedUrlStub.getCall(1).calledWithExactly('a fake next page'));
            assert.equal(logs.length, parseInt(process.env.paws_max_pages_per_invocation) + 1);
            assert.equal(newState.nextPage, 'a fake next page');
            restoreO365ManagemntStub();
        });
        it('Resumes pagination when it recieves a nextpage in the state', async function () {
            const creds = await O365Collector.load();
            var collector = new O365Collector(ctx, creds, 'o365');
            subscriptionsContentStub = sinon.stub(collector.o365_mgmnt_client, 'subscriptionsContent').callsFake(
                function fakeFn(contentType, startTs, endTs, options) {
                    return new Promise(function (resolve, reject) {
                        var result = {
                            contentUri: "https://joeiscool.com/joeiscool"
                        };
                        return resolve({
                            nextPageUri: 'a fake next page',
                            parsedBody: [result]
                        });
                    });
                });
            getPreFormedUrlStub = sinon.stub(collector.o365_mgmnt_client, 'getPreFormedUrl').callsFake(
                function (path, extraOptions) {
                    return new Promise(function (resolve, reject) {
                        var result = {
                            contentUri: "https://joeiscool.com/nextpage"
                        };
                        return resolve({
                            nextPageUri: 'a fake next page',
                            parsedBody: [result]
                        });
                    });
                });
            const startDate = moment().subtract(3, 'days');
            const curState = {
                stream: "FakeStream",
                nextPage: "next page from state",
                since: startDate.toISOString(),
                until: startDate.add(2, 'days').toISOString(),
                poll_interval_sec: 1
            };

            const [logs, newState] = await collector.pawsGetLogs(curState);
            assert.equal(subscriptionsContentStub.called, false);
            assert.ok(getPreFormedUrlStub.getCall(0).calledWithExactly('next page from state'));
            assert.ok(getPreFormedUrlStub.getCall(1).calledWithExactly('a fake next page'));
            assert.equal(logs.length, parseInt(process.env.paws_max_pages_per_invocation) + 1);
            assert.equal(newState.nextPage, 'a fake next page');
            restoreO365ManagemntStub();
        });

        it('Get next state with hourCap when  Start timestamp is more than 7 days in the past', async function () {
            const creds = await O365Collector.load();
            var collector = new O365Collector(ctx, creds);
            subscriptionsContentStub = sinon.stub(collector.o365_mgmnt_client, 'subscriptionsContent');
            subscriptionsContentStub.callsFake(
                function fakeFn(path, extraOptions) {
                    return new Promise(function (resolve, reject) {
                        var result = {
                            contentUri: "https://joeiscool.com/joeiscool"
                        };
                        return resolve({
                            nextPageUri: 'a fake next page',
                            parsedBody: [result]
                        });
                    });
                });
            getPreFormedUrlStub = sinon.stub(collector.o365_mgmnt_client, 'getPreFormedUrl');
            getPreFormedUrlStub.callsFake(
                function (path, extraOptions) {
                    return new Promise(function (resolve, reject) {
                        var result = {
                            contentUri: "https://joeiscool.com/nextpage"
                        };
                        return resolve({
                            nextPageUri: undefined,
                            parsedBody: [result]
                        });
                    });
                });
            const startDate = moment().subtract(10, 'days');
            const curState = {
                stream: "FakeStream",
                since: startDate.toISOString(),
                until: startDate.add(2, 'days').toISOString(),
                poll_interval_sec: 1
            };

            const [logs, newState] = await collector.pawsGetLogs(curState);
            assert.equal(moment(newState.until).diff(newState.since, 'hours'), 1);
            assert.equal(newState.poll_interval_sec, 1);
            assert.equal(logs.length, 2);
            restoreO365ManagemntStub();
        });

        it('Get next state with custom collection interval when  Start timestamp is more than 7 days in the past and paws_collection_interval exist in env', async function () {
            const creds = await O365Collector.load();
            var collector = new O365Collector(ctx, creds);

            subscriptionsContentStub = sinon.stub(collector.o365_mgmnt_client, 'subscriptionsContent');
            subscriptionsContentStub.callsFake(
                function fakeFn(contentType, startTs, endTs, options) {
                    return new Promise(function (resolve, reject) {
                        var result = {
                            contentUri: "https://joeiscool.com/joeiscool"
                        };
                        return resolve({
                            nextPageUri: 'a fake next page',
                            parsedBody: [result]
                        });
                    });
                });
            getPreFormedUrlStub = sinon.stub(collector.o365_mgmnt_client, 'getPreFormedUrl');
            getPreFormedUrlStub.callsFake(
                function (path, extraOptions) {
                    return new Promise(function (resolve, reject) {
                        var result = {
                            contentUri: "https://joeiscool.com/nextpage"
                        };
                        return resolve({
                            nextPageUri: undefined,
                            parsedBody: [result]
                        });
                    });
                });
            const startDate = moment().subtract(10, 'days');
            const curState = {
                stream: "FakeStream",
                since: startDate.toISOString(),
                until: startDate.add(2, 'days').toISOString(),
                poll_interval_sec: 1
            };

            process.env.paws_collection_interval = 1200;
            const [logs, newState] = await collector.pawsGetLogs(curState);
            if (newState) {
                assert.equal(moment(newState.until).diff(newState.since, 'minutes'), 60);
                assert.equal(newState.poll_interval_sec, 1);
                assert.equal(logs.length, 2);
            }
            restoreO365ManagemntStub();
            process.env.paws_collection_interval = 0;
        });

        it('Get Logs check client error', async function () {
            const creds = await O365Collector.load();
            var collector = new O365Collector(ctx, creds, 'o365');

            subscriptionsContentStub = sinon.stub(collector.o365_mgmnt_client, 'subscriptionsContent').callsFake(
                function fakeFn(contentType, startTs, endTs, options) {
                    return new Promise(function (resolve, reject) {
                        return reject({ message: 'Get Token request returned http error: 400 and server response: {"error":"invalid_request","error_description":"AADSTS90002: Tenant bf8d32d3-1c13-4487-af02-80dba22364851 not found. This may happen if there are no active subscriptions for the tenant. Check to make sure you have the correct tenant ID.","error_codes":[90002],"timestamp":"2020-11-24 08:41:22Z","trace_id":"dcf34502-9b8b-4601-b5ec-3d33437b9d00","correlation_id":"f82dc929-3899-4ba5-890f-cf18ac92e0a3","error_uri":"https://login.microsoftonline.com/error?code=90002"}' });
                    });
                });
            getPreFormedUrlStub = sinon.stub(collector.o365_mgmnt_client, 'getPreFormedUrl').callsFake(
                function fakeFn(path, extraOptions) {
                    return new Promise(function (resolve, reject) {
                        return resolve({ parsedBody: [o365Mock.MOCK_LOG] });
                    });
                });
            const startDate = moment().subtract(3, 'days');
            const curState = {
                since: startDate.toISOString(),
                until: startDate.add(2, 'days').toISOString(),
                poll_interval_sec: 1
            };

            try {
                await collector.pawsGetLogs(curState);
                assert.fail('Expected pawsGetLogs to throw');
            } catch (err) {
                assert.notEqual(err, null);
                assert.equal(err.errorCode, 'invalid_request');
                restoreO365ManagemntStub();
            }
        });

        it('Handle the `_handleExpiredContentError` error and reduce state.since by 15 min', async function () {
            const creds = await O365Collector.load();
            var collector = new O365Collector(ctx, creds, 'o365');

            subscriptionsContentStub = sinon.stub(collector.o365_mgmnt_client, 'subscriptionsContent').callsFake(
                function fakeFn(path, extraOptions) {
                    return new Promise(function (resolve, reject) {
                        var result = {
                            contentUri: "https://joeiscool.com/joeiscool"
                        };
                        return resolve({
                            nextPageUri: undefined,
                            parsedBody: [result]
                        });
                    });
                });
            getPreFormedUrlStub = sinon.stub(collector.o365_mgmnt_client, 'getPreFormedUrl').callsFake(
                function fakeFn(path, extraOptions) {
                    return new Promise(function (resolve, reject) {
                        return reject({
                            statusCode: 400, message: '{\"statusCode\":400,\"request\":{\"url\":\"https://manage.office.com/api/v1.0/ff406706-779b-40b1-a27b-8543d2dd81de/activity/feed/audit/20210701062038480000814$20210701062307893000918$audit_exchange$Audit_Exchange$na0014?PublisherIdentifier=ff406706-779b-40b1-a27b-8543d2dd81de\",\"method\":\"GET\",\"headers\":{\"_headersMap\":{\"accept-language\":{\"name\":\"accept-language\",\"value\":\"en-US\"},\"content-type\":{\"name\":\"content-type\",\"value\":\"application/json; charset=utf-8\"},\"x-ms-client-request-id\":{\"name\":\"x-ms-client-request-id\",\"value\":\"a8ac1b8f-37b4-4449-adfc-10442a93201b\"}}}},\"response\":{\"body\":\"{\\\"error\\\":{\\\"code\\\":\\\"AF20051\\\",\\\"message\\\":\\\"Content requested with the key 20210701062038480000814$20210701062307893000918$audit_exchange$Audit_Exchange$na0014 has already expired. Content older than 7 days cannot be retrieved.\\\"}}\",\"status\":400}}',
                            response:
                            {
                                body:
                                    '{"error":{"code":"AF20051","message":"Content requested with the key 20210701062038480000814$20210701062307893000918$audit_exchange$Audit_Exchange$na0014 has already expired. Content older than 7 days cannot be retrieved."}}'
                            }
                        });
                    });
                });
            const startDate = moment();
            const curState = {
                since: startDate.toISOString(),
                until: startDate.add(1, 'hours').toISOString(),
                poll_interval_sec: 1
            };

            const [logs, newState, newPollInterval] = await collector.pawsGetLogs(curState);
            assert.equal(logs.length, 0);
            assert.equal(moment(newState.until).diff(newState.since, 'minutes'), 60);
            assert.equal(newPollInterval, curState.poll_interval_sec);
            restoreO365ManagemntStub();
        });
    });
    describe('pawsGetRegisterParameters', function () {
        let ctx = {
            invokedFunctionArn: o365Mock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };

        it('Get register body', async function () {
            const creds = await O365Collector.load();
            var collector = new O365Collector(ctx, creds, 'o365');
            const sampleEvent = { ResourceProperties: { StackName: 'a-stack-name' } };

            const regValues = await collector.pawsGetRegisterParameters(sampleEvent);
            const expectedRegValues = {
                azureStreams: '["Audit.AzureActiveDirectory", "Audit.Exchange", "Audit.SharePoint", "Audit.General"]',
                azureTenantId: '79ca7c9d-83ce-498f-952f-4c03b56ab573'
            };
            assert.deepEqual(regValues, expectedRegValues);
        });
    });

    describe('Format Tests', function () {
        it('log format success', async function () {
            let ctx = {
                invokedFunctionArn: o365Mock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                },
                succeed: function () {
                }
            };
            const creds = await O365Collector.load();
            var collector = new O365Collector(ctx, creds, 'o365');
            let fmt = collector.pawsFormatLog(o365Mock.LOG_EVENT);
            assert.equal(fmt.progName, 'O365Collector');
            assert.ok(fmt.messageTypeId);
        });
    });
});
