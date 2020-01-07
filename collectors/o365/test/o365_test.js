const assert = require('assert');
const sinon = require('sinon');
var AWS = require('aws-sdk-mock');
const moment = require('moment');
const m_response = require('cfn-response');

const o365Mock = require('./o365_mock');
var m_alCollector = require('@alertlogic/al-collector-js');
const m_o365mgmnt = require('../lib/o365_mgmnt');
var O365Collector = require('../o365_collector').O365Collector;
const m_al_aws = require('@alertlogic/al-aws-collector-js').Util;


var alserviceStub = {};
var responseStub = {};
var setEnvStub = {};
var subscriptionsContentStub;
var getContentStub;

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
    subscriptionsContentStub = sinon.stub(m_o365mgmnt, 'subscriptionsContent').callsFake(
        function fakeFn(path, extraOptions) {
            return new Promise(function(resolve, reject) {
                var result = {
                    contentUri: "https://joeiscool.com/joeiscool"
                };
                return resolve([result]);
            });
        });
    getContentStub = sinon.stub(m_o365mgmnt, 'getContent').callsFake(
            function fakeFn(path, extraOptions) {
                return new Promise(function(resolve, reject) {
                    return resolve([o365Mock.MOCK_LOG]);
                });
            });
}

function restoreO365ManagemntStub() {
    subscriptionsContentStub.restore();
    getContentStub.restore();
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
    });
    
    describe('pawsInitCollectionState', function() {
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
        it('get inital state less than 7 days in the past', function(done) {
            O365Collector.load().then(function(creds) {
                var collector = new O365Collector(ctx, creds, 'o365');
                const startDate = moment().subtract(1, 'days').toISOString();
                process.env.paws_collection_start_ts = startDate;

                collector.pawsInitCollectionState(o365Mock.LOG_EVENT, (err, initialState, nextPoll) => {
                    assert.equal(initialState.since, startDate, "Dates are not equal");
                    assert.notEqual(moment(initialState.until).diff(initialState.since, 'hours'), 24)
                    done();
                });
            });
        });
        it('get inital state more than 7 days in the past', function(done) {
            O365Collector.load().then(function(creds) {
                var collector = new O365Collector(ctx, creds, 'o365');
                const startDate = moment().subtract(8, 'days').toISOString();
                process.env.paws_collection_start_ts = startDate;

                collector.pawsInitCollectionState(o365Mock.LOG_EVENT, (err, initialState, nextPoll) => {
                    assert.notEqual(initialState.since, startDate, "Date is more than 7 days in the past");
                    assert.equal(moment(initialState.until).diff(initialState.since, 'hours'), 24)
                    done();
                });
            });
        });
        it('get inital state less than 24 hours in the past', function(done) {
            O365Collector.load().then(function(creds) {
                var collector = new O365Collector(ctx, creds, 'o365');
                const startDate = moment().subtract(12, 'hours').toISOString();
                process.env.paws_collection_start_ts = startDate;

                collector.pawsInitCollectionState(o365Mock.LOG_EVENT, (err, initialState, nextPoll) => {
                    assert.notEqual(moment(initialState.until).diff(initialState.since, 'hours'), 24)
                    done();
                });
            });
        });
        it('get inital state more than 7 days in the past', function(done) {
            O365Collector.load().then(function(creds) {
                var collector = new O365Collector(ctx, creds, 'o365');
                const startDate = moment().subtract(2, 'days').toISOString();
                process.env.paws_collection_start_ts = startDate;

                collector.pawsInitCollectionState(o365Mock.LOG_EVENT, (err, initialState, nextPoll) => {
                    assert.equal(moment(initialState.until).diff(initialState.since, 'hours'), 24)
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
                done();
            },
            succeed : function() {
                done();
            }
        };
        it('get next state if more than 24 hours in the past', function(done) {
            const startDate = moment().subtract(3, 'days')
            const curState = {
                since: startDate.toISOString(),
                until: startDate.add(2, 'days').toISOString(),
                poll_interval_sec: 1
            };
            O365Collector.load().then(function(creds) {
                var collector = new O365Collector(ctx, creds, 'o365');
                const newState = collector._getNextCollectionState(curState);
                assert.equal(moment(newState.until).diff(newState.since, 'hours'), 1)
                assert.equal(newState.poll_interval_sec, 1);
                done();
            });
        });
        it('get next state if less than 24 hours in the past but more than an hour', function(done) {
            const startDate = moment().subtract(3, 'hours')
            const curState = {
                since: startDate.toISOString(),
                until: startDate.add(1, 'hours').toISOString(),
                poll_interval_sec: 1
            };
            O365Collector.load().then(function(creds) {
                var collector = new O365Collector(ctx, creds, 'o365');
                const newState = collector._getNextCollectionState(curState);
                assert.equal(moment(newState.until).diff(newState.since, 'hours'), 1)
                assert.equal(newState.poll_interval_sec, 1);
                done();
            });
        });
        it('get next state if less than 1 hour in the past but more than the polling interval', function(done) {
            const startDate = moment().subtract(20, 'minutes')
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
                const startDate = moment().subtract(collector.pollInterval * 2, 'seconds')
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
                done();
            },
            succeed : function() {
                done();
            }
        };

        it('Get Logs Sunny', function(done) {
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
            setO365MangementStub();
            O365Collector.load().then(function(creds) {
                var collector = new O365Collector(ctx, creds, 'o365');
                const startDate = moment().subtract(3, 'days')
                const curState = {
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    poll_interval_sec: 1
                };

                let fmt = collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) =>{
                    assert.equal(logs.length, 4);
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
            getContentStub = sinon.stub(m_o365mgmnt, 'getContent').callsFake(
                    function fakeFn(path, extraOptions) {
                        return new Promise(function(resolve, reject) {
                            return resolve([o365Mock.MOCK_LOG]);
                        });
                    });

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
                const startDate = moment().subtract(3, 'days')
                const curState = {
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    poll_interval_sec: 1
                };

                let fmt = collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) =>{
                    assert.notEqual(err, null);
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
                done();
            },
            succeed : function() {
                done();
            }
        };

        it('Get register body', function(done) {
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
                const sampleEvent = {ResourceProperties: {StackName: 'a-stack-name'}};

                let fmt = collector.pawsGetRegisterParameters(sampleEvent, (err, regValues) =>{
                    const expectedRegValues = {
                        dataType: collector._ingestType,
                        version: collector._version,
                        pawsCollectorType: 'o365',
                        collectorId: 'none',
                        stackName: sampleEvent.ResourceProperties.StackName
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
