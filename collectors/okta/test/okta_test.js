const assert = require('assert');
const sinon = require('sinon');
const moment = require('moment');
const nock = require('nock');
const m_response = require('cfn-response');
const okta = require('@okta/okta-sdk-nodejs');

const oktaMock = require('./okta_mock');
var m_alCollector = require('@alertlogic/al-collector-js');
var OktaCollector = require('../okta_collector').OktaCollector;
const m_al_aws = require('@alertlogic/al-aws-collector-js').Util;
const { CloudWatch } = require("@aws-sdk/client-cloudwatch"),
    { KMS } = require("@aws-sdk/client-kms"),
    { SSM } = require("@aws-sdk/client-ssm");


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
        
        sinon.stub(SSM.prototype, 'getParameter').callsFake(function (params, callback) {
            const data = Buffer.from('test-secret');
            return callback(null, { Parameter: { Value: data.toString('base64') } });
        });

        sinon.stub(KMS.prototype, 'decrypt').callsFake(function (params, callback) {
            const data = {
                Plaintext: Buffer.from('decrypted-sercret-key')
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
        KMS.prototype.decrypt.restore();
        SSM.prototype.getParameter.restore();
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
                const testPollInterval = 300;
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
                const testPollInterval = 300;
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

        it('it should return the same state with pollinterval delay if get api return throttle error', function (done) {
            const { Client } = okta;
            const error = { "name": "OktaApiError", "status": 429, "errorCode": "E0000047", "errorSummary": "API call exceeded rate limit due to too many requests.", "errorCauses": [], "errorLink": "E0000047", "errorId": "oaeJacBsJ0pQES61B_uegmlzA", "url": "https://alertlogic-admin.okta.com/api/v1/logs?since=2023-06-03T08%3A32%3A20.000Z&until=2023-06-03T08%3A33%3A20.000Z", "headers": {}, "message": "Okta HTTP 429 E0000047 API call exceeded rate limit due to too many requests.. " };
            const oktaSdkMock = sinon.stub(Client.prototype, 'getLogs').callsFake(() => {
                return {
                    each: () => {
                        return new Promise((res, rej) => {
                            rej(error);
                        });
                    }
                };
            });
            OktaCollector.load().then(function (creds) {
                var collector = new OktaCollector(ctx, creds);
                const startDate = moment().subtract(1, 'days').toISOString();
                const mockState = {
                    since: startDate,
                    until: moment().toISOString(),
                    poll_interval_sec: 60
                };
                var reportSpy = sinon.spy(collector, 'reportApiThrottling');
                let putMetricDataStub = sinon.stub(CloudWatch.prototype, 'putMetricData').callsFake((params, callback) => callback()) ;
                collector.pawsGetLogs(mockState, (err, logs, state, pollIntervalSec) => {
                    assert.equal(true, reportSpy.calledOnce);
                    assert.equal(err, null);
                    // if header not return rate-limit-resect-sec then add the 60 sec in existing pollinterval seconds
                    assert.equal(pollIntervalSec, 120);
                    oktaSdkMock.restore();
                    putMetricDataStub.restore();
                    done();
                });
            });
        });
        it('It should set the delay second if there is throttle error and header contain X-Rate-Limit-Reset', function (done) {
            const { Client } = okta;
            const resetSecs = moment().add(120, 'seconds').unix();
            const error = { "name": "OktaApiError", "status": 429, "errorCode": "E0000047", "errorSummary": "API call exceeded rate limit due to too many requests.", "url": "https://alertlogic-admin.okta.com/api/v1/logs?since=2023-06-03T08%3A32%3A20.000Z&until=2023-06-03T08%3A33%3A20.000Z", "headers": { "x-rate-limit-reset": resetSecs }, "message": "Okta HTTP 429 E0000047 API call exceeded rate limit due to too many requests.. " };
            const oktaSdkMock = sinon.stub(Client.prototype, 'getLogs').callsFake(() => {
                return {
                    each: () => {
                        return new Promise((res, rej) => {
                            rej(error);
                        });
                    }
                };
            });
            OktaCollector.load().then(function (creds) {
                var collector = new OktaCollector(ctx, creds);
                const startDate = moment().subtract(1, 'days').toISOString();
                const mockState = {
                    since: startDate,
                    until: moment().toISOString(),
                    poll_interval_sec: 60
                };
                var reportSpy = sinon.spy(collector, 'reportApiThrottling');
                let putMetricDataStub = sinon.stub(CloudWatch.prototype, 'putMetricData').callsFake((params, callback) => callback()) ;
                collector.pawsGetLogs(mockState, (err, logs, state, poll_interval_sec) => {
                    assert.equal(true, reportSpy.calledOnce);
                    assert.equal(err, null);
                    assert.equal(poll_interval_sec, 180);
                    oktaSdkMock.restore();
                    putMetricDataStub.restore();
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
                let putMetricDataStub = sinon.stub(CloudWatch.prototype, 'putMetricData').callsFake((params, callback) => callback()) ;
                collector.pawsGetLogs(mockState, (err) => {
                    assert.equal(true, reportSpy.calledOnce);
                    putMetricDataStub.restore();
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
                const testPollInterval = 300;
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

        it('no error code', function(done) {
            const {Client} = okta;
            let errorObj = {
                status: 401,
                url: "https://ft-test.oktapreview.com/api/v1/logs?since=2020-08-13T20%3A00%3A04.000Z&until=2020-08-13T20%3A01%3A04.000Z"
            };
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
            const oktaSdkMock = sinon.stub(Client.prototype, 'getLogs').callsFake(() => {
                return {
                    each: (callback) => {
                        ['foo', 'bar', 'baz'].forEach(callback);
                        return new Promise((res, rej) => {
                            rej(errorObj);
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
                    oktaSdkMock.restore();
                    assert.equal(err.status, "401");
                    done();
                });
            });
        });
    });
});
