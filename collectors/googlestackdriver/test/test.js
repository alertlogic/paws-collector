const assert = require('assert');
const sinon = require('sinon');
const moment = require('moment');
const { google } = require('googleapis');
const { CloudWatch } = require("@aws-sdk/client-cloudwatch"),
    { KMS } = require("@aws-sdk/client-kms"),
    { SSM } = require("@aws-sdk/client-ssm");

const googlestackdriverMock = require('./mock');
const logEntriesService = google.logging('v2');
var GooglestackdriverCollector = require('../collector').GooglestackdriverCollector;
const { auth } = require("google-auth-library");
let mockauthenticationObject;
let mocklogEntriesServiceObject;

function setAlServiceStub() {
    mockauthenticationObject = sinon.stub(auth, 'fromJSON').callsFake(
        function fakeFn(path) {
            return {};
        });
}

function restoreAlServiceStub() {
    mockauthenticationObject.restore();
}
var logginClientStub = {};

function setLoggingClientStub(){
    logginClientStub = sinon.stub(logEntriesService.entries, 'list');

    logginClientStub.onCall(0).callsFake(() => {
        return new Promise((res, rej) => {
            res({
                data: {
                    entries: [
                        googlestackdriverMock.LOG_EVENT_PROTO_PAYLOAD2,
                        googlestackdriverMock.LOG_EVENT_TEXT_PAYLOAD,
                        googlestackdriverMock.LOG_EVENT_JSON_PAYLOAD
                    ],
                    nextPageToken: 'http://somenextpage.com'
                }
            });
        });
    });

    logginClientStub.onCall(1).callsFake(() => {
        return new Promise((res, rej) => {
            res({
                data: {
                    entries: [
                        googlestackdriverMock.LOG_EVENT_PROTO_PAYLOAD,
                        googlestackdriverMock.LOG_EVENT_TEXT_PAYLOAD,
                        googlestackdriverMock.LOG_EVENT_JSON_PAYLOAD
                    ],
                    nextPageToken: null
                }
            });
        });
    });
}

function restoreLoggingClientStub(){
    logginClientStub.restore();
}

describe('Unit Tests', function() {
    beforeEach(function(){
        sinon.stub(SSM.prototype, 'getParameter').callsFake(function (params, callback) {
            const data = Buffer.from('test-secret');
            return callback(null, { Parameter: { Value: data.toString('base64') } });
        });

        sinon.stub(KMS.prototype, 'decrypt').callsFake(function (params, callback) {
            const data = {
                Plaintext: Buffer.from('{"foo":"decrypted-sercret-key"}')
            };
            return callback(null, data);
        });
        logEntriesService.entries = googlestackdriverMock.MOCK_ENTRIES;
        mocklogEntriesServiceObject = sinon.stub(google, 'logging').callsFake(
            function fakeFn(path) {
                return logEntriesService;
            });
        setAlServiceStub();
    });

    afterEach(function(){
        restoreAlServiceStub();
        mocklogEntriesServiceObject.restore();
        KMS.prototype.decrypt.restore();
        SSM.prototype.getParameter.restore();
    });

    describe('Next state tests', function() {
    });

    describe('pawsInitCollectionState', function() {
        let ctx = {
            invokedFunctionArn : googlestackdriverMock.FUNCTION_ARN,
            fail : function(error) {
                assert.fail(error);
            },
            succeed : function() {}
        };
        it('get inital state less than 24 hours in the past', function(done) {
            GooglestackdriverCollector.load().then(function(creds) {
                var collector = new GooglestackdriverCollector(ctx, creds);
                const startDate = moment().subtract(12, 'hours').toISOString();
                process.env.paws_collection_start_ts = startDate;

                collector.pawsInitCollectionState(googlestackdriverMock.LOG_EVENT, (err, initialStates, nextPoll) => {
                    initialStates.forEach((state) => {
                        assert.notEqual(moment(state.until).diff(state.since, 'hours'), 24);
                    });
                    done();
                });
            });
        });
        it('get inital state more than 7 days in the past', function(done) {
            GooglestackdriverCollector.load().then(function(creds) {
                var collector = new GooglestackdriverCollector(ctx, creds);
                const startDate = moment().subtract(2, 'days').toISOString();
                process.env.paws_collection_start_ts = startDate;

                collector.pawsInitCollectionState(googlestackdriverMock.LOG_EVENT, (err, initialStates, nextPoll) => {
                    initialStates.forEach((state) => {
                        assert.equal(moment(state.until).diff(state.since, 'hours'), 24);
                    });
                    done();
                });
            });
        });
    });

    describe('pawsGetLogs', function() {
        let ctx = {
            invokedFunctionArn : googlestackdriverMock.FUNCTION_ARN,
            fail : function(error) {
                assert.fail(error);
            },
            succeed : function() {}
        };

        it('Get Logs Sunny', function(done) {
            setLoggingClientStub();
            GooglestackdriverCollector.load().then(function(creds) {
                var collector = new GooglestackdriverCollector(ctx, creds);
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    stream: "projects/a-fake-project",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    poll_interval_sec: 1
                };

                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) =>{
                    assert.equal(logs.length, 6);
                    assert.equal(moment(newState.until).diff(newState.since, 'seconds'), process.env.paws_poll_interval);
                    assert.equal(newState.poll_interval_sec, 1);
                    restoreLoggingClientStub();
                    done();
                });
            });
        });

        it('Get Logs Cloudy', function(done) {
            logginClientStub = sinon.stub(logEntriesService.entries, 'list');
            logginClientStub.onCall(0).callsFake(() => {
                return new Promise((res, rej) => {
                    rej("Here is an error");
                });
            });

            GooglestackdriverCollector.load().then(function(creds) {
                var collector = new GooglestackdriverCollector(ctx, creds);
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    poll_interval_sec: 1
                };

                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) =>{
                    assert.notEqual(err, null);
                    restoreLoggingClientStub();
                    done();
                });
            });
        });

        it('Get Logs check API Throttling', function(done) {
            logginClientStub = sinon.stub(logEntriesService.entries, 'list');
            logginClientStub.onCall(0).callsFake(() => {
                return new Promise((res, rej) => {
                    rej({code:8,
                        details: `Quota exceeded for quota metric 'Read requests' and limit 'Read requests per minute' of service 'logging.googleapis.com' for consumer 'project_number:45454'`});
                });
            });

            GooglestackdriverCollector.load().then(function(creds) {
                var collector = new GooglestackdriverCollector(ctx, creds);
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    poll_interval_sec: 1
                };

                var reportSpy = sinon.spy(collector, 'reportApiThrottling');
                let putMetricDataStub = sinon.stub(CloudWatch.prototype, 'putMetricData').callsFake((params, callback) => callback());
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) =>{
                    assert.equal(moment(curState.until).diff(newState.until, 'days'), 1);
                    assert.equal(true, reportSpy.calledOnce);
                    assert.equal(logs.length, 0);
                    assert.equal(newPollInterval, 120);
                    restoreLoggingClientStub();
                    putMetricDataStub.restore();
                    done();
                });
            });
        });

       it(`Get Logs check API Throttling when going through pagination then check if it reduce page size and able to fetch the data`, function(done) {
        logginClientStub = sinon.stub(logEntriesService.entries, 'list');
                    logginClientStub.onCall(0).callsFake(() => {
                return new Promise((res, rej) => {
                    rej({code: 8,
                        details: 'Received message larger than max (4776477 vs. 4194304)'});
                });
            });

            GooglestackdriverCollector.load().then(function(creds) {
                var collector = new GooglestackdriverCollector(ctx, creds);
                const startDate = moment().subtract(1, 'hours');
                const curState = {
                    since: startDate.toISOString(),
                    until: startDate.add(15, 'seconds').toISOString(),
                    poll_interval_sec: 1,
                    nextPage:{"filter":"timestamp >= \"2022-01-21T00:00:15.000Z\"\ntimestamp < \"2022-01-22T00:00:15.000Z\"","pageSize":1000,"resourceNames":["projects/test"],"pageToken":"EAA46o"},
                    stream: 'projects/test',
                };

                var reportSpy = sinon.spy(collector, 'reportApiThrottling');
                let putMetricDataStub = sinon.stub(CloudWatch.prototype, 'putMetricData').callsFake((params, callback) => callback());
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) =>{
                    assert.equal(moment(newState.until).diff(newState.since, 'seconds'), 15);
                    assert.equal(true, reportSpy.calledOnce);
                    assert.equal(newState.nextPage.pageSize, 500);
                    assert.equal(logs.length, 0);
                    assert.equal(newPollInterval, 120);
                    restoreLoggingClientStub();
                    putMetricDataStub.restore();
                    done();
                });
            });
        });
      
        it(`Get Logs check API Throttling with 'Received message larger than max (4776477 vs. 4194304)' for time interval less than 15 sec then check with reduce page size able to fetch the data`, function(done) {
            logginClientStub = sinon.stub(logEntriesService.entries, 'list');            
            logginClientStub.onCall(0).callsFake(() => {
                return new Promise((res, rej) => {
                    rej({code: 8,
                        message: 'Received message larger than max (4776477 vs. 4194304)'});
                });
            });

            GooglestackdriverCollector.load().then(function(creds) {
                var collector = new GooglestackdriverCollector(ctx, creds);
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    since: startDate.toISOString(),
                    until: startDate.add(15, 'seconds').toISOString(),
                    stream: "projects/project-test",
                    poll_interval_sec: 60
                };

                var reportSpy = sinon.spy(collector, 'reportApiThrottling');
                let putMetricDataStub = sinon.stub(CloudWatch.prototype, 'putMetricData').callsFake((params, callback) => callback());
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) =>{
                    assert.equal(newState.pageSize, 500);
                    assert.equal(true, reportSpy.calledOnce);
                    assert.equal(logs.length, 0);
                    assert.equal(newPollInterval, 120);
                    restoreLoggingClientStub();
                    putMetricDataStub.restore();
                    done();
                });
            });
        });

        it('Stops paginiating at the pagination limit', function(done) {
            logginClientStub = sinon.stub(logEntriesService.entries, 'list');
            const startDate = moment().subtract(3, 'days');
            let since = startDate.toISOString();
            let until = startDate.add(2, 'days').toISOString();
            const filter = `timestamp >= "${since}" AND timestamp < "${until}"`;
            let nextPage = { pageToken: 'http://somenextpage.com', "pageSize": 1000, "resourceNames": ["projects/a-fake-project"], filter };
            logginClientStub.callsFake(() => {
                return new Promise((res, rej) => {
                    res({
                        data: {
                            entries: [googlestackdriverMock.LOG_EVENT_PROTO_PAYLOAD2],
                            nextPageToken: 'http://somenextpage.com'
                        }
                        });
                });
            });
            GooglestackdriverCollector.load().then(function(creds) {
                var collector = new GooglestackdriverCollector(ctx, creds);
                const curState = {
                    stream: "projects/a-fake-project",
                    since,
                    until,
                    poll_interval_sec: 1
                };
                
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) =>{
                    assert.ok(logginClientStub.calledTwice);
                    assert.equal(logs.length, parseInt(process.env.paws_max_pages_per_invocation));
                    assert.deepEqual(newState.nextPage, nextPage);
                    restoreLoggingClientStub();
                    done();
                });
            });
        });

        it('Get Logs check client error', function(done) {
            logginClientStub = sinon.stub(logEntriesService.entries, 'list');
            
            logginClientStub.onCall(0).callsFake(() => {
                return new Promise((res, rej) => {
                    rej({
                        code: 401,
                        errors:
                            [{
                                message: 'unauthorized_client',
                                domain: 'global',
                                reason: 'Unauthorized'
                            }]
                    });
                });
            });

            GooglestackdriverCollector.load().then(function(creds) {
                var collector = new GooglestackdriverCollector(ctx, creds);
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    poll_interval_sec: 1
                };

                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) =>{
                    assert.equal(err.errorCode, 'Unauthorized');
                    restoreLoggingClientStub();
                    done();
                });
            });
        });
    });

    describe('_getNextCollectionState', function() {
        let ctx = {
            invokedFunctionArn : googlestackdriverMock.FUNCTION_ARN,
            fail : function(error) {
                assert.fail(error);
            },
            succeed : function() {}
        };
        it('get next state if more than 7 days in the past', function(done) {
            const startDate = moment().subtract(10, 'days');
            const curState = {
                since: startDate.toISOString(),
                until: startDate.add(2, 'days').toISOString(),
                poll_interval_sec: 1
            };
            GooglestackdriverCollector.load().then(function(creds) {
                var collector = new GooglestackdriverCollector(ctx, creds);
                const newState = collector._getNextCollectionState(curState);
                assert.equal(moment(newState.until).diff(newState.since, 'days'), 7);
                assert.equal(newState.poll_interval_sec, 1);
                done();
            });
        });
        it('get next state if more than 24 hours in the past', function(done) {
            const startDate = moment().subtract(4, 'days');
            const curState = {
                since: startDate.toISOString(),
                until: startDate.add(2, 'days').toISOString(),
                poll_interval_sec: 1
            };
            GooglestackdriverCollector.load().then(function(creds) {
                var collector = new GooglestackdriverCollector(ctx, creds);
                const newState = collector._getNextCollectionState(curState);
                assert.equal(moment(newState.until).diff(newState.since, 'hours'), 24);
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
            GooglestackdriverCollector.load().then(function(creds) {
                var collector = new GooglestackdriverCollector(ctx, creds);
                const newState = collector._getNextCollectionState(curState);
                assert.equal(moment(newState.until).diff(newState.since, 'seconds'), process.env.paws_poll_interval);
                assert.equal(newState.poll_interval_sec, 1);
                done();
            });
        });
        it('get next state if less than 1 hour in the past but more than the polling interval', function(done) {
            const startDate = moment().subtract(20, 'minutes');
            GooglestackdriverCollector.load().then(function(creds) {
                var collector = new GooglestackdriverCollector(ctx, creds);
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
        it('get next state and check if page size less than 1000 ,reset it back', function(done) {
            const startDate = moment().subtract(20, 'minutes');
            GooglestackdriverCollector.load().then(function(creds) {
                var collector = new GooglestackdriverCollector(ctx, creds);
                const curState = {
                    since: startDate.toISOString(),
                    until: startDate.add(collector.pollInterval, 'seconds').toISOString(),
                    poll_interval_sec: 1,
                    stream: 'projects/test',
                };
                const nextPage = {"filter":"timestamp >= \"2022-01-21T00:00:15.000Z\"\ntimestamp < \"2022-01-22T00:00:15.000Z\"","pageSize":500,"resourceNames":["projects/test"],"pageToken":"EAA46o"};
                const newState = collector._getNextCollectionState(curState, nextPage);
                assert.equal(moment(newState.until).diff(newState.since, 'seconds'), collector.pollInterval);
                assert.equal(newState.poll_interval_sec, 1);
                assert.equal(newState.nextPage.pageSize, 1000);
                done();
            });
        });
        it('get next state if within polling interval', function(done) {
            GooglestackdriverCollector.load().then(function(creds) {
                var collector = new GooglestackdriverCollector(ctx, creds);
                const startDate = moment().subtract(collector.pollInterval * 2, 'seconds');
                const curState = {
                    since: startDate.toISOString(),
                    until: startDate.add(collector.pollInterval, 'seconds').toISOString(),
                    poll_interval_sec: 1
                };
                const newState = collector._getNextCollectionState(curState);
                assert.equal(moment(newState.until).diff(newState.since, 'seconds'), collector.pollInterval);
                assert.equal(newState.poll_interval_sec, 300);
                done();
            });
        });
    });
    describe('Format Tests', function() {
        it('log format JSON success', function(done) {
            let ctx = {
                invokedFunctionArn : googlestackdriverMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            
            GooglestackdriverCollector.load().then(function(creds) {
                var collector = new GooglestackdriverCollector(ctx, creds, 'googlestackdriver');
                let fmt = collector.pawsFormatLog(googlestackdriverMock.LOG_EVENT_JSON_PAYLOAD);
                assert.equal(
                    fmt.messageTypeId,
                    googlestackdriverMock.
                        LOG_EVENT_JSON_PAYLOAD.
                        jsonPayload
                );
                done();
            });
        });

        it('log format TEXT success', function(done) {
            let ctx = {
                invokedFunctionArn : googlestackdriverMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            
            GooglestackdriverCollector.load().then(function(creds) {
                var collector = new GooglestackdriverCollector(ctx, creds, 'googlestackdriver');
                let fmt = collector.pawsFormatLog(googlestackdriverMock.LOG_EVENT_TEXT_PAYLOAD);
                assert.equal(
                    fmt.messageTypeId,
                    googlestackdriverMock.
                        LOG_EVENT_TEXT_PAYLOAD.
                        payload
                );
                done();
            });
        });

        it('log format PROTO success', function(done) {
            let ctx = {
                invokedFunctionArn : googlestackdriverMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            
            GooglestackdriverCollector.load().then(function(creds) {
                var collector = new GooglestackdriverCollector(ctx, creds, 'googlestackdriver');
                let fmt = collector.pawsFormatLog(googlestackdriverMock.LOG_EVENT_PROTO_PAYLOAD);
                assert.equal(
                    fmt.messageTypeId,
                    googlestackdriverMock.
                        LOG_EVENT_PROTO_PAYLOAD.
                        protoPayload['@type']
                );
                done();
            });
        });
    });
    describe('log filter Tests', function() {
        it('should generate correct filter excluding empty logType values', function (done) {
            let ctx = {
                invokedFunctionArn: googlestackdriverMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };
            
            GooglestackdriverCollector.load().then(function (creds) {
                var collector = new GooglestackdriverCollector(ctx, creds, 'googlestackdriver');
                const startDate = moment().subtract(20, 'minutes');
                let since = startDate.toISOString();
                let until = startDate.add(collector.pollInterval, 'seconds').toISOString();
                process.env.paws_collector_param_string_2 = "[\"cloudaudit.googleapis.com%2Factivity\",\"\",\"cloudfunctions.googleapis.com/cloud-functions\"]";
                const curState = {
                    since: since,
                    until: until,
                    poll_interval_sec: 1,
                    stream: 'projects/imran-49253',
                };
                // Expected filter string
                const expectedFilter = `timestamp >= "${since}" AND timestamp < "${until}" AND (logName:"cloudaudit.googleapis.com%2Factivity" OR logName:"cloudfunctions.googleapis.com%2Fcloud-functions")`;

                // Call the function to generate the filter
                const filter = collector.generateFilter(curState);
                assert.equal(expectedFilter, filter);
                done();
            });
        });

        it('should generate filter without logNameFilter when all logTypes are empty', function (done) {
            let ctx = {
                invokedFunctionArn: googlestackdriverMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };
            
            GooglestackdriverCollector.load().then(function (creds) {
                var collector = new GooglestackdriverCollector(ctx, creds, 'googlestackdriver');
                const startDate = moment().subtract(20, 'minutes');
                let since = startDate.toISOString();
                let until = startDate.add(collector.pollInterval, 'seconds').toISOString();
                process.env.paws_collector_param_string_2 = "[\"\",\"\"]";
                const curState = {
                    since: since,
                    until: until,
                    poll_interval_sec: 1,
                    stream: 'projects/imran-49253',
                };
                // Expected filter string
                const expectedFilter = `timestamp >= "${since}" AND timestamp < "${until}"`;

                // Call the function to generate the filter
                const filter = collector.generateFilter(curState);
                assert.equal(expectedFilter, filter);
                done();
            });
        });
        it('should handle case when logTypes is undefined or null', function (done) {
            let ctx = {
                invokedFunctionArn: googlestackdriverMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };
            
            GooglestackdriverCollector.load().then(function (creds) {
                var collector = new GooglestackdriverCollector(ctx, creds, 'googlestackdriver');
                const startDate = moment().subtract(20, 'minutes');
                let since = startDate.toISOString();
                let until = startDate.add(collector.pollInterval, 'seconds').toISOString();
                const curState = {
                    since: since,
                    until: until,
                    poll_interval_sec: 1,
                    stream: 'projects/imran-49253',
                };
                // Expected filter string
                const expectedFilter = `timestamp >= "${since}" AND timestamp < "${until}"`;

                // Call the function to generate the filter
                const filter = collector.generateFilter(curState);
                assert.equal(expectedFilter, filter);
                done();
            });
        });     
    });
});
   