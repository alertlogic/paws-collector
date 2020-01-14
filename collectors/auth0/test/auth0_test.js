const assert = require('assert');
const sinon = require('sinon');
const moment = require('moment');
var AWS = require('aws-sdk-mock');
const m_response = require('cfn-response');

const auth0Mock = require('./auth0_mock');
var m_alCollector = require('@alertlogic/al-collector-js');
var Auth0Collector = require('../auth0_collector').Auth0Collector;
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
    });

    describe('pawsInitCollectionState', function() {
        let ctx = {
            invokedFunctionArn : auth0Mock.FUNCTION_ARN,
            fail : function(error) {
                assert.fail(error);
            },
            succeed : function() {}
        };
        it('sets up intial state', function(done) {
            Auth0Collector.load().then(function(creds) {
                const testPollInterval = 60;
                var collector = new Auth0Collector(ctx, creds);
                const startDate = moment().subtract(1, 'days').toISOString();
                process.env.paws_collection_start_ts = startDate;
                collector.pollInterval = testPollInterval;

                collector.pawsInitCollectionState({}, (err, initialState, nextPoll) => {
                    assert.equal(initialState.since, startDate, "Dates are not equal");
                    assert.equal(initialState.poll_interval_sec, 1);
                    assert.equal(nextPoll, 1);
                    done();
                });
            });
        });
    });
    describe('Format Tests', function() {
        it('log format success', function(done) {
            let ctx = {
                invokedFunctionArn : auth0Mock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            
            Auth0Collector.load().then(function(creds) {
                var collector = new Auth0Collector(ctx, creds);
                let fmt = collector.pawsFormatLog(auth0Mock.AUTH0_LOG_EVENT);
                assert.equal(fmt.progName, 'Auth0Collector');
                assert.ok(fmt.messageTypeId);
                done();
            });
        });
    });
});
