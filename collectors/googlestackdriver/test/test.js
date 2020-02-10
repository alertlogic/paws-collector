const assert = require('assert');
const sinon = require('sinon');
const moment = require('moment');
var AWS = require('aws-sdk-mock');
const m_response = require('cfn-response');
const logging = require('@google-cloud/logging');

const googlestackdriverMock = require('./mock');
var m_alCollector = require('@alertlogic/al-collector-js');
var GooglestackdriverCollector = require('../collector').GooglestackdriverCollector;
const m_al_aws = require('@alertlogic/al-aws-collector-js').Util;


var alserviceStub = {};
var responseStub = {};
var setEnvStub = {};
var logginClientStub = {};

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

function setLoggingClientStub(){
    logginClientStub = sinon.stub(logging.v2.LoggingServiceV2Client.prototype, 'listLogEntries');
    
    logginClientStub.onCall(0).callsFake(() => {
        return new Promise((res, rej) => {
            res([
                [
                    googlestackdriverMock.LOG_EVENT_PROTO_PAYLOAD,
                    googlestackdriverMock.LOG_EVENT_TEXT_PAYLOAD,
                    googlestackdriverMock.LOG_EVENT_JSON_PAYLOAD
                ],
                'http://somenextpage.com'
            ]);
        });
    });

    logginClientStub.onCall(1).callsFake(() => {
        return new Promise((res, rej) => {
            res([
                [
                    googlestackdriverMock.LOG_EVENT_PROTO_PAYLOAD,
                    googlestackdriverMock.LOG_EVENT_TEXT_PAYLOAD,
                    googlestackdriverMock.LOG_EVENT_JSON_PAYLOAD
                ],
                null
            ]);
        });
    });
}

function restoreLoggingClientStub(){
    logginClientStub.restore();
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

describe('Unit Tests', function() {
    beforeEach(function(){
        AWS.mock('SSM', 'getParameter', function (params, callback) {
            const data = new Buffer('test-secret');
            return callback(null, {Parameter : { Value: data.toString('base64')}});
        });

        AWS.mock('KMS', 'decrypt', function (params, callback) {
            const data = {
                Plaintext : '{"foo":"decrypted-sercret-key"}'
            };
            return callback(null, data);
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
                    resource: "projects/a-fake-project",
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
            logginClientStub = sinon.stub(logging.v2.LoggingServiceV2Client.prototype, 'listLogEntries');
            
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

        it('Stops paginiating at the pagination limit', function(done) {
            logginClientStub = sinon.stub(logging.v2.LoggingServiceV2Client.prototype, 'listLogEntries');
            
            logginClientStub.callsFake(() => {
                return new Promise((res, rej) => {
                    res([
                        [
                            googlestackdriverMock.LOG_EVENT_PROTO_PAYLOAD
                        ],
                        'http://somenextpage.com'
                    ]);
                });
            });
            GooglestackdriverCollector.load().then(function(creds) {
                var collector = new GooglestackdriverCollector(ctx, creds);
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    resource: "projects/a-fake-project",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    poll_interval_sec: 1
                };

                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) =>{
                    assert.ok(logginClientStub.calledTwice);
                    assert.equal(logs.length, parseInt(process.env.paws_max_pages_per_invocation));
                    assert.equal(newState.nextPage, 'http://somenextpage.com');
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
                assert.equal(newState.poll_interval_sec, collector.pollInterval);
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
                        jsonPayload.
                        fields.
                        event_type.stringValue
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
                        protoPayload.
                        type_url
                );
                done();
            });
        });
    });
});
