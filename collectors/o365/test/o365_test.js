const assert = require('assert');
const sinon = require('sinon');
var AWS = require('aws-sdk-mock');
const moment = require('moment');
const m_response = require('cfn-response');

const o365Mock = require('./o365_mock');
var m_alCollector = require('@alertlogic/al-collector-js');
const m_o365mgmnt = require('../lib/o365_mgmnt');
const { checkO365Subscriptions } = require('../healthcheck.js');
var O365Collector = require('../o365_collector').O365Collector;
const m_al_aws = require('@alertlogic/al-aws-collector-js').Util;


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
            return new Promise(function(resolve, reject) {
                var ret = null;
                switch (path) {
                    case '/residency/default/services/ingest/endpoint':
                        ret = {
                            ingest : 'new-ingest-endpoint'
                    };
                        break;
                case '/residency/default/services/azcollect/endpoint':
                    ret = {
                        azcollect : 'new-azcollect-endpoint'
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
                return new Promise(function(resolve, reject) {
                    return resolve();
                });
            });
    alserviceStub.del = sinon.stub(m_alCollector.AlServiceC.prototype, 'deleteRequest').callsFake(
            function fakeFn(path) {
                return new Promise(function(resolve, reject) {
                    return resolve();
                });
            });
}

function restoreAlServiceStub() {
    alserviceStub.get.restore();
    alserviceStub.post.restore();
    alserviceStub.del.restore();
}

function setO365MangementStub() {
    listSubscriptionsStub = sinon.stub(m_o365mgmnt, 'listSubscriptions').callsFake(
        function fakeFn(extraOptions) {
            return new Promise(function(resolve, reject) {
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
            return new Promise(function(resolve, reject) {
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
        function fakeFn(path, extraOptions) {
            return new Promise(function(resolve, reject) {
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
                return new Promise(function(resolve, reject) {
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
    setEnvStub = sinon.stub(m_al_aws, 'setEnv').callsFake((vars, callback)=>{
        const {
            ingest_api,
            azcollect_api
        } = vars;
        process.env.ingest_api = ingest_api ? ingest_api : process.env.ingest_api;
        process.env.azollect_api = azcollect_api ? azcollect_api : process.env.azollect_api;
        const returnBody = {
            Environment: {
                Varaibles: vars
            }
        };
        return callback(null, returnBody);
    });
}

describe('O365 Collector Tests', function() {

    beforeEach(function(){
        AWS.mock('KMS', 'decrypt', function (params, callback) {
            const data = {
                    Plaintext : 'decrypted-aims-sercret-key'
            };
            return callback(null, data);
        });

        AWS.mock('SSM', 'getParameter', function (params, callback) {
            const data = new Buffer('test-secret');
            return callback(null, {Parameter : { Value: data.toString('base64')}});
        });

        responseStub = sinon.stub(m_response, 'send').callsFake(
            function fakeFn(event, mockContext, responseStatus, responseData, physicalResourceId) {
                mockContext.succeed();
            });

        setAlServiceStub();
        mockSetEnvStub();
    });

    afterEach(function(){
        restoreAlServiceStub();
        setEnvStub.restore();
        responseStub.restore();
        AWS.restore('KMS');
        AWS.restore('SSM');
    });

    describe('healthcheck', function() {
        it('does not start subscriptions when streams are enabled', function(done) {
            setO365MangementStub();
            const tempStreams = process.env.collector_streams;
            process.env.collector_streams = "[\"Audit.Exchange\", \"Audit.General\"]";
            checkO365Subscriptions((err) => {
                assert.equal(err, null);
                assert.equal(startSubscriptionStub.called, false);
                restoreO365ManagemntStub();
                process.env.collector_streams = tempStreams;
                done();
            });
        });

        it('starts subscriptions when streams are not enabled', function(done) {
            setO365MangementStub();
            const tempStreams = process.env.collector_streams;
            process.env.collector_streams = "[\"Audit.Exchange\", \"Audit.Sharepoint\", \"Audit.General\"]";
            checkO365Subscriptions((err) => {
                assert.equal(err, null);
                assert.equal(startSubscriptionStub.called, true);
                restoreO365ManagemntStub();
                process.env.collector_streams = tempStreams;
                done();
            });
        });
    });

    describe('pawsInitCollectionState', function() {
        let ctx = {
            invokedFunctionArn : o365Mock.FUNCTION_ARN,
            fail : function(error) {
                assert.fail(error);
            },
            succeed : function() {}
        };
        it('get inital state less than 7 days in the past', function(done) {
            O365Collector.load().then(function(creds) {
                var collector = new O365Collector(ctx, creds, 'o365');
                const startDate = moment().subtract(1, 'days').toISOString();
                process.env.paws_collection_start_ts = startDate;

                collector.pawsInitCollectionState(o365Mock.LOG_EVENT, (err, initialStates, nextPoll) => {
                    initialStates.forEach((state) => {
                        assert.equal(state.since, startDate, "Dates are not equal");
                        assert.notEqual(moment(state.until).diff(state.since, 'hours'), 24);
                    });
                    done();
                });
            });
        });
        it('get inital state more than 7 days in the past', function(done) {
            O365Collector.load().then(function(creds) {
                var collector = new O365Collector(ctx, creds, 'o365');
                const startDate = moment().subtract(8, 'days').toISOString();
                process.env.paws_collection_start_ts = startDate;

                collector.pawsInitCollectionState(o365Mock.LOG_EVENT, (err, initialStates, nextPoll) => {
                    initialStates.forEach((state) => {
                        assert.notEqual(state.since, startDate, "Date is more than 7 days in the past");
                        assert.equal(moment(state.until).diff(state.since, 'hours'), 24);
                    });
                    done();
                });
            });
        });
        it('get inital state less than 24 hours in the past', function(done) {
            O365Collector.load().then(function(creds) {
                var collector = new O365Collector(ctx, creds, 'o365');
                const startDate = moment().subtract(12, 'hours').toISOString();
                process.env.paws_collection_start_ts = startDate;

                collector.pawsInitCollectionState(o365Mock.LOG_EVENT, (err, initialStates, nextPoll) => {
                    initialStates.forEach((state) => {
                        assert.notEqual(moment(state.until).diff(state.since, 'hours'), 24);
                    });
                    done();
                });
            });
        });
        it('get inital state more than 7 days in the past', function(done) {
            O365Collector.load().then(function(creds) {
                var collector = new O365Collector(ctx, creds, 'o365');
                const startDate = moment().subtract(2, 'days').toISOString();
                process.env.paws_collection_start_ts = startDate;

                collector.pawsInitCollectionState(o365Mock.LOG_EVENT, (err, initialStates, nextPoll) => {
                    initialStates.forEach((state) => {
                        assert.equal(moment(state.until).diff(state.since, 'hours'), 24);
                    });
                    done();
                });
            });
        });
    });

    describe('_getNextCollectionState', function() {
        let ctx = {
            invokedFunctionArn : o365Mock.FUNCTION_ARN,
            fail : function(error) {
                assert.fail(error);
            },
            succeed : function() {}
        };
        it('get next state if more than 24 hours in the past', function(done) {
            const startDate = moment().subtract(3, 'days');
            const curState = {
                since: startDate.toISOString(),
                until: startDate.add(2, 'days').toISOString(),
                poll_interval_sec: 1
            };
            O365Collector.load().then(function(creds) {
                var collector = new O365Collector(ctx, creds, 'o365');
                const newState = collector._getNextCollectionState(curState);
                assert.equal(moment(newState.until).diff(newState.since, 'hours'), 1);
                assert.equal(newState.poll_interval_sec, 1);
                done();
            });
        });
        it('get next state if less than 24 hours in the past but more than an hour', function(done) {
            const startDate = moment().subtract(3, 'hours');
            const curState = {
                since: startDate.toISOString(),
                until: startDate.add(1, 'hours').toISOString(),
                poll_interval_sec: 1
            };
            O365Collector.load().then(function(creds) {
                var collector = new O365Collector(ctx, creds, 'o365');
                const newState = collector._getNextCollectionState(curState);
                assert.equal(moment(newState.until).diff(newState.since, 'hours'), 1);
                assert.equal(newState.poll_interval_sec, 1);
                done();
            });
        });
        it('get next state if less than 1 hour in the past but more than the polling interval', function(done) {
            const startDate = moment().subtract(20, 'minutes');
            O365Collector.load().then(function(creds) {
                var collector = new O365Collector(ctx, creds, 'o365');
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
        it('get next state if within polling interval', function(done) {
            O365Collector.load().then(function(creds) {
                var collector = new O365Collector(ctx, creds, 'o365');
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

    describe('pawsGetLogs', function() {
        let ctx = {
            invokedFunctionArn : o365Mock.FUNCTION_ARN,
            fail : function(error) {
                assert.fail(error);
            },
            succeed : function() {}
        };

        it('Updates a stale state', function(done) {
            setO365MangementStub();
            O365Collector.load().then(function(creds) {
                var collector = new O365Collector(ctx, creds, 'o365');
                const startDate = moment().subtract(10, 'days');
                const curState = {
                    stream: "FakeStream",
                    since: startDate.toISOString(),
                    until: startDate.add(1, 'days').toISOString(),
                    poll_interval_sec: 1
                };

                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) =>{
                    const callArgs = subscriptionsContentStub.getCall(0).args;

                    assert.equal(callArgs[0], curState.stream);
                    assert.equal(moment().diff(callArgs[1], 'days'), 7);
                    assert.equal(moment(callArgs[2]).diff(callArgs[1], 'hours'), 1);
                    restoreO365ManagemntStub();
                    done();
                });
            });
        });

        it('Updates a stale state', function(done) {
            setO365MangementStub();
            O365Collector.load().then(function(creds) {
                var collector = new O365Collector(ctx, creds, 'o365');
                const startDate = moment().subtract(10, 'days');
                const curState = {
                    stream: "FakeStream",
                    since: startDate.toISOString(),
                    until: startDate.add(1, 'days').toISOString(),
                    nextPage: 'https://www.joecantprogram.com?nextpagetoken=8675309',
                    poll_interval_sec: 1
                };

                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) =>{
                    const callArgs = subscriptionsContentStub.getCall(0).args;

                    assert.equal(callArgs[0], curState.stream);
                    assert.equal(moment().diff(callArgs[1], 'days'), 7);
                    assert.equal(moment(callArgs[2]).diff(callArgs[1], 'hours'), 1);
                    assert.equal(getPreFormedUrlStub.calledWith(curState.nextPage), false);
                    restoreO365ManagemntStub();
                    done();
                });
            });
        });

        it('check if state moment is null or blank', function (done) {
            setO365MangementStub();
            O365Collector.load().then(function (creds) {
                var collector = new O365Collector(ctx, creds, 'o365');
                const curState = {
                    stream: "FakeStream",
                    since: "",
                    until: null,
                    poll_interval_sec: 1
                };

                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(logs.length, 0);
                    assert.equal(moment(newState.until).diff(newState.since, 'seconds'), collector.pollInterval);
                    assert.equal(newState.poll_interval_sec, collector.pollInterval);
                    restoreO365ManagemntStub();
                    done();
                });
            });
        });

        it('check if since and until are undefined', function (done) {
            setO365MangementStub();
            O365Collector.load().then(function (creds) {
                var collector = new O365Collector(ctx, creds, 'o365');
                const curState = {
                    stream: "FakeStream",
                    since: undefined,
                    until: undefined,
                    poll_interval_sec: 1
                };

                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(logs.length, 0);
                    assert.equal(moment(newState.until).diff(newState.since, 'seconds'), collector.pollInterval);
                    assert.equal(newState.poll_interval_sec, collector.pollInterval);
                    restoreO365ManagemntStub();
                    done();
                });
            });
        });

        it('Get Logs Sunny', function(done) {
            setO365MangementStub();
            O365Collector.load().then(function(creds) {
                var collector = new O365Collector(ctx, creds, 'o365');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    stream: "FakeStream",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    poll_interval_sec: 1
                };

                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) =>{
                    assert.equal(logs.length, 1);
                    assert.equal(moment(newState.until).diff(newState.since, 'hours'), 1);
                    assert.equal(newState.poll_interval_sec, 1);
                    restoreO365ManagemntStub();
                    done();
                });
            });
        });

        it('Get Logs Cloudy', function(done) {
            subscriptionsContentStub = sinon.stub(m_o365mgmnt, 'subscriptionsContent').callsFake(
                function fakeFn(path, extraOptions) {
                    return new Promise(function(resolve, reject) {
                        return reject('Here is an Error');
                    });
                });
            getPreFormedUrlStub = sinon.stub(m_o365mgmnt, 'getPreFormedUrl').callsFake(
                    function fakeFn(path, extraOptions) {
                        return new Promise(function(resolve, reject) {
                            return resolve({parsedBody: [o365Mock.MOCK_LOG]});
                        });
                    });

            O365Collector.load().then(function(creds) {
                var collector = new O365Collector(ctx, creds, 'o365');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    poll_interval_sec: 1
                };

                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) =>{
                    assert.notEqual(err, null);
                    restoreO365ManagemntStub();
                    done();
                });
            });
        });
        it('Get next content page when present', function(done) {
            subscriptionsContentStub = sinon.stub(m_o365mgmnt, 'subscriptionsContent').callsFake(
                function fakeFn(path, extraOptions) {
                    return new Promise(function(resolve, reject) {
                        var result = {
                            contentUri: "https://joeiscool.com/joeiscool"
                        };
                        return resolve({
                            nextPageUri: 'a fake next page',
                            parsedBody: [result]
                        });
                    });
                });
            getPreFormedUrlStub = sinon.stub(m_o365mgmnt, 'getPreFormedUrl');
            getPreFormedUrlStub.onCall(0).callsFake(
                function(path, extraOptions) {
                    return new Promise(function(resolve, reject) {
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
                function(path, extraOptions) {
                    return new Promise(function(resolve, reject) {
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
                function(path, extraOptions) {
                    return new Promise(function(resolve, reject) {
                        var result = {
                            aLogKey: "SomeLogValue2"
                        };
                        return resolve({
                            nextPageUri: undefined,
                            parsedBody: [result]
                        });
                    });
                });
            O365Collector.load().then(function(creds) {
                var collector = new O365Collector(ctx, creds, 'o365');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    stream: "FakeStream",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    poll_interval_sec: 1
                };

                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) =>{
                    assert.ok(getPreFormedUrlStub.calledWith("https://joeiscool.com/joeiscool"));
                    assert.equal(logs.length, 2);
                    restoreO365ManagemntStub();
                    done();
                });
            });
        });

        it('Stops paginiating at the pagination limit', function(done) {
            subscriptionsContentStub = sinon.stub(m_o365mgmnt, 'subscriptionsContent').callsFake(
                function fakeFn(path, extraOptions) {
                    return new Promise(function(resolve, reject) {
                        var result = {
                            contentUri: "https://joeiscool.com/joeiscool"
                        };
                        return resolve({
                            nextPageUri: 'a fake next page',
                            parsedBody: [result]
                        });
                    });
                });
            getPreFormedUrlStub = sinon.stub(m_o365mgmnt, 'getPreFormedUrl').callsFake(
                function(path, extraOptions) {
                    console.log("calling stub", path);
                    return new Promise(function(resolve, reject) {
                        var result = {
                            contentUri: "https://joeiscool.com/nextpage"
                        };
                        return resolve({
                            nextPageUri: 'a fake next page',
                            parsedBody: [result]
                        });
                    });
                });
            O365Collector.load().then(function(creds) {
                var collector = new O365Collector(ctx, creds, 'o365');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    stream: "FakeStream",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    poll_interval_sec: 1
                };

                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) =>{
                    assert.ok(getPreFormedUrlStub.getCall(0).calledWithExactly('a fake next page'));
                    assert.ok(getPreFormedUrlStub.getCall(1).calledWithExactly('a fake next page'));
                    assert.equal(logs.length, parseInt(process.env.paws_max_pages_per_invocation) + 1);
                    assert.equal(newState.nextPage, 'a fake next page');
                    restoreO365ManagemntStub();
                    done();
                });
            });
        });
        it('Resumes pagination when it recieves a nextpage in the state', function(done) {
            subscriptionsContentStub = sinon.stub(m_o365mgmnt, 'subscriptionsContent').callsFake(
                function fakeFn(path, extraOptions) {
                    return new Promise(function(resolve, reject) {
                        var result = {
                            contentUri: "https://joeiscool.com/joeiscool"
                        };
                        return resolve({
                            nextPageUri: 'a fake next page',
                            parsedBody: [result]
                        });
                    });
                });
            getPreFormedUrlStub = sinon.stub(m_o365mgmnt, 'getPreFormedUrl').callsFake(
                function(path, extraOptions) {
                    console.log("calling stub", path);
                    return new Promise(function(resolve, reject) {
                        var result = {
                            contentUri: "https://joeiscool.com/nextpage"
                        };
                        return resolve({
                            nextPageUri: 'a fake next page',
                            parsedBody: [result]
                        });
                    });
                });
            O365Collector.load().then(function(creds) {
                var collector = new O365Collector(ctx, creds, 'o365');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    stream: "FakeStream",
                    nextPage: "next page from state",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    poll_interval_sec: 1
                };

                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) =>{
                    assert.equal(subscriptionsContentStub.called, false);
                    assert.ok(getPreFormedUrlStub.getCall(0).calledWithExactly('next page from state'));
                    assert.ok(getPreFormedUrlStub.getCall(1).calledWithExactly('a fake next page'));
                    assert.equal(logs.length, parseInt(process.env.paws_max_pages_per_invocation) + 1);
                    assert.equal(newState.nextPage, 'a fake next page');
                    restoreO365ManagemntStub();
                    done();
                });
            });
        });

        it('Get Logs check client error', function(done) {
            subscriptionsContentStub = sinon.stub(m_o365mgmnt, 'subscriptionsContent').callsFake(
                function fakeFn(path, extraOptions) {
                    return new Promise(function(resolve, reject) {
                        return reject({message:'Get Token request returned http error: 400 and server response: {"error":"invalid_request","error_description":"AADSTS90002: Tenant bf8d32d3-1c13-4487-af02-80dba22364851 not found. This may happen if there are no active subscriptions for the tenant. Check to make sure you have the correct tenant ID.","error_codes":[90002],"timestamp":"2020-11-24 08:41:22Z","trace_id":"dcf34502-9b8b-4601-b5ec-3d33437b9d00","correlation_id":"f82dc929-3899-4ba5-890f-cf18ac92e0a3","error_uri":"https://login.microsoftonline.com/error?code=90002"}'});
                    });
                });
            getPreFormedUrlStub = sinon.stub(m_o365mgmnt, 'getPreFormedUrl').callsFake(
                    function fakeFn(path, extraOptions) {
                        return new Promise(function(resolve, reject) {
                            return resolve({parsedBody: [o365Mock.MOCK_LOG]});
                        });
                    });

            O365Collector.load().then(function(creds) {
                var collector = new O365Collector(ctx, creds, 'o365');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    poll_interval_sec: 1
                };

                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) =>{
                    assert.notEqual(err, null);
                    assert.equal(err.errorCode ,'invalid_request');
                    restoreO365ManagemntStub();
                    done();
                });
            });
        });
    });
    describe('pawsGetRegisterParameters', function() {
        let ctx = {
            invokedFunctionArn : o365Mock.FUNCTION_ARN,
            fail : function(error) {
                assert.fail(error);
            },
            succeed : function() {}
        };

        it('Get register body', function(done) {
            O365Collector.load().then(function(creds) {
                var collector = new O365Collector(ctx, creds, 'o365');
                const sampleEvent = {ResourceProperties: {StackName: 'a-stack-name'}};

                collector.pawsGetRegisterParameters(sampleEvent, (err, regValues) =>{
                    const expectedRegValues = {
                        azureStreams: '["Audit.AzureActiveDirectory", "Audit.Exchange", "Audit.SharePoint", "Audit.General"]',
                        azureTenantId: '79ca7c9d-83ce-498f-952f-4c03b56ab573'
                    };
                    assert.deepEqual(regValues, expectedRegValues);
                    done();
                });
            });
        });
    });

    describe('Format Tests', function() {
        it('log format success', function(done) {
            let ctx = {
                invokedFunctionArn : o365Mock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            O365Collector.load().then(function(creds) {
                var collector = new O365Collector(ctx, creds, 'o365');
                let fmt = collector.pawsFormatLog(o365Mock.LOG_EVENT);
                assert.equal(fmt.progName, 'O365Collector');
                assert.ok(fmt.messageTypeId);
                done();
            });
        });
    });
});
