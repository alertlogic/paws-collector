const assert = require('assert');
const sinon = require('sinon');
const moment = require('moment');
const nock = require('nock');
var AWS = require('aws-sdk-mock');
const m_response = require('cfn-response');
const okta = require('@okta/okta-sdk-nodejs');

const oktaMock = require('./okta_mock');
var m_alCollector = require('@alertlogic/al-collector-js');
var OktaCollector = require('../okta_collector').OktaCollector;
const m_al_aws = require('@alertlogic/al-aws-collector-js').Util;


var alserviceStub = {};
var responseStub = {};
var setEnvStub = {};

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
        if (!nock.isActive()) {
            nock.activate();
        }
        
        AWS.mock('SSM', 'getParameter', function (params, callback) {
            const data = new Buffer('test-secret');
            return callback(null, {Parameter : { Value: data.toString('base64')}});
        });

        AWS.mock('KMS', 'decrypt', function (params, callback) {
            const data = {
                    Plaintext : 'decrypted-sercret-key'
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

    describe('pawsInitCollectionState', function() {
        let ctx = {
            invokedFunctionArn : oktaMock.FUNCTION_ARN,
            fail : function(error) {
                assert.fail(error);
            },
            succeed : function() {}
        };
        it('sets up intial state (startDate < now - pollInterval)', function(done) {
            OktaCollector.load().then(function(creds) {
                const testPollInterval = 60;
                var collector = new OktaCollector(ctx, creds);
                const startDate = moment().subtract(1, 'days').toISOString();
                process.env.paws_collection_start_ts = startDate;
                collector.pollInterval = testPollInterval;

                collector.pawsInitCollectionState(oktaMock.LOG_EVENT, (err, initialState, nextPoll) => {
                    assert.equal(initialState.since, startDate, "Dates are not equal");
                    assert.equal(moment(initialState.until).diff(initialState.since, 'seconds'), testPollInterval);
                    assert.equal(initialState.poll_interval_sec, 1);
                    assert.equal(nextPoll, 1);
                    done();
                });
            });
        });
        
        it('sets up intial state (now - pollInterval < startDate < now)', function(done) {
            OktaCollector.load().then(function(creds) {
                const testPollInterval = 60;
                var collector = new OktaCollector(ctx, creds);
                const startDate = moment().subtract(20, 'seconds').toISOString();
                process.env.paws_collection_start_ts = startDate;
                collector.pollInterval = testPollInterval;

                collector.pawsInitCollectionState(oktaMock.LOG_EVENT, (err, initialState, nextPoll) => {
                    assert.equal(initialState.since, startDate, "Dates are not equal");
                    assert.equal(moment(initialState.until).diff(initialState.since, 'seconds'), testPollInterval);
                    assert.equal(initialState.poll_interval_sec, testPollInterval);
                    assert.equal(nextPoll, testPollInterval);
                    done();
                });
            });
        });
        
        it('sets up intial state (startDate = now)', function(done) {
            OktaCollector.load().then(function(creds) {
                const testPollInterval = 60;
                var collector = new OktaCollector(ctx, creds);
                const startDate = moment().toISOString();
                process.env.paws_collection_start_ts = startDate;
                collector.pollInterval = testPollInterval;

                collector.pawsInitCollectionState(oktaMock.LOG_EVENT, (err, initialState, nextPoll) => {
                    assert.equal(initialState.since, startDate, "Dates are not equal");
                    assert.equal(moment(initialState.until).diff(initialState.since, 'seconds'), testPollInterval);
                    assert.equal(initialState.poll_interval_sec, testPollInterval);
                    assert.equal(nextPoll, testPollInterval);
                    done();
                });
            });
        });
    });

    describe('pawsGetLogs', function() {
        let ctx = {
            invokedFunctionArn : oktaMock.FUNCTION_ARN,
            fail : function(error) {
                assert.fail(error);
            },
            succeed : function() {}
        };
        it('gets logs correctly', function(done) {
            const {Client} = okta;
            const oktaSdkMock = sinon.stub(Client.prototype, 'getLogs').callsFake(() => {
                return {
                    each: (callback) => {
                        ['foo', 'bar', 'baz'].forEach(callback);
                        return new Promise((res, rej) => {
                            res();
                        });
                    }
                };
            });
            OktaCollector.load().then(function(creds) {
                var collector = new OktaCollector(ctx, creds);
                const startDate = moment().subtract(1, 'days').toISOString();
                const mockState = {
                    since: startDate,
                    until: moment().toISOString()
                };

                collector.pawsGetLogs(mockState, (err, logs, newState, nextPoll) => {
                    assert.equal(logs.length, 3);
                    assert.equal(newState.since, mockState.until);
                    oktaSdkMock.restore();
                    done();
                });
            });
        });

        it('gets logs throttling', function(done) {
            const {Client} = okta;
            const oktaSdkMock = sinon.stub(Client.prototype, 'getLogs').callsFake(() => {
                return {
                    each: () => {
                        return new Promise((res, rej) => {
                            rej(new Error('HTTP request time exceeded okta.client.rateLimit.requestTimeout'));
                        });
                    }
                };
            });
            OktaCollector.load().then(function(creds) {
                var collector = new OktaCollector(ctx, creds);
                const startDate = moment().subtract(1, 'days').toISOString();
                const mockState = {
                    since: startDate,
                    until: moment().toISOString()
                };
                var reportSpy = sinon.spy(collector, 'reportApiThrottling');
                
                collector.pawsGetLogs(mockState, (err) => {
                    assert.equal(true, reportSpy.calledOnce);
                    oktaSdkMock.restore();
                    done();
                });
            });
        });
        
        it('gets logs throttling response', function(done) {
            
            // Okta endpoints mock
            nock('https://test.alertlogic.com:443', {'encodedQueryParams':true})
            .get('/api/v1/logs')
            .query(true)
            .times(1)
            .reply(429);
            OktaCollector.load().then(function(creds) {
                var collector = new OktaCollector(ctx, creds);
                const startDate = moment().subtract(1, 'days').toISOString();
                const mockState = {
                    since: startDate,
                    until: moment().toISOString()
                };
                var reportSpy = sinon.spy(collector, 'reportApiThrottling');
                
                collector.pawsGetLogs(mockState, (err) => {
                    assert.equal(true, reportSpy.calledOnce);
                    done();
                });
            });
        });
    });

    describe('_getNextCollectionState', function() {
        let ctx = {
            invokedFunctionArn : oktaMock.FUNCTION_ARN,
            fail : function(error) {
                assert.fail(error);
            },
            succeed : function() {}
        };
        it('sets the correct since if the last until is in the future', function(done) {
            const startDate = moment();
            const curState = {
                since: startDate.toISOString(),
                until: startDate.add(2, 'days').toISOString(),
                poll_interval_sec: 1
            };
            OktaCollector.load().then(function(creds) {
                const testPollInterval = 55;
                var collector = new OktaCollector(ctx, creds, 'okta');
                collector.pollInterval = testPollInterval;
                const newState = collector._getNextCollectionState(curState);
                assert.notEqual(moment(newState.until).toISOString(), curState.until);
                assert.equal(newState.poll_interval_sec, collector.pollInterval);
                done();
            });
        });
    });

    
    describe('Format Tests', function() {
        it('log format success', function(done) {
            let ctx = {
                invokedFunctionArn : oktaMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            
            OktaCollector.load().then(function(creds) {
                var collector = new OktaCollector(ctx, creds);
                let fmt = collector.pawsFormatLog(oktaMock.OKTA_LOG_EVENT);
                assert.equal(fmt.progName, 'OktaCollector');
                assert.ok(fmt.messageTypeId);
                done();
            });
        });

        it('redacts sensitive fields', function(done) {
            let ctx = {
                invokedFunctionArn : oktaMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };

            OktaCollector.load().then(function(creds) {
                var collector = new OktaCollector(ctx, creds);
                let fmt = collector.pawsFormatLog(oktaMock.OKTA_LOG_EVENT);
                let msg = JSON.parse(fmt.message);
                assert.equal(msg.client.apiToken, undefined);
                assert.equal(msg.client.http.defaultHeaders.Authorization, undefined);
                assert.ok(fmt.messageTypeId);
                done();
            });
        });

        it('formats message if sensitive fields not present', function(done) {
            let ctx = {
                invokedFunctionArn : oktaMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };

            OktaCollector.load().then(function(creds) {
                var collector = new OktaCollector(ctx, creds);
                let fmt = collector.pawsFormatLog({eventType: "value"});
                assert.ok(fmt.messageTypeId);
                done();
            });
        });
    });
    describe('Health Check Tests', function() {
        it('token validation check success', function(done) {
            let ctx = {
                invokedFunctionArn : oktaMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };

            const oktaHealth = require('../health_checks');
            // Okta endpoints mock
            nock('https://test.alertlogic.com:443', {'encodedQueryParams':true})
            .get('/api/v1/users/me')
            .query(true)
            .times(1)
            .reply(200);
            
            OktaCollector.load().then(function(creds) {
                var collector = new OktaCollector(ctx, creds);
                oktaHealth.oktaTokenHealthCheck.apply(collector)(function(err) {
                    assert.equal(null, err);
                    done();
                });
            });
            
        });
        it('token validation check fail', function(done) {
            let ctx = {
                invokedFunctionArn : oktaMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };

            const oktaHealth = require('../health_checks');
            // Okta endpoints mock
            nock('https://test.alertlogic.com:443', {'encodedQueryParams':true})
            .get('/api/v1/users/me')
            .query(true)
            .times(1)
            .reply(401, { 
                errorCode: 'E0000011',
                errorSummary: 'Invalid token provided',
                errorLink: 'E0000011',
                errorId: 'testid',
                errorCauses: [] });
            
            const expectedError = { status: 'error',
                    code: 'OKTA000003',
                    details: 'Failed to validate auth token for test.alertlogic.com due to error 401 - {"errorCode":"E0000011","errorSummary":"Invalid token provided","errorLink":"E0000011","errorId":"testid","errorCauses":[]}' };

            OktaCollector.load().then(function(creds) {
                var collector = new OktaCollector(ctx, creds);
                oktaHealth.oktaTokenHealthCheck.apply(collector)(function(err) {
                    assert.deepEqual(err, expectedError);
                    done();
                });
            });
            
        });
    });
});
