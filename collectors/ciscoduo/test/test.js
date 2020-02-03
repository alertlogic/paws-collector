const assert = require('assert');
//const sinon = require('sinon');
var AWS = require('aws-sdk-mock');

const ciscoduoMock = require('./ciscoduo_mock');
var CiscoduoCollector = require('../ciscoduo_collector').CiscoduoCollector;

const DUO_ENDPOINT_AUTH = '/admin/v2/logs/authentication';
const DUO_ENDPOINT_ADMIN = '/admin/v1/logs/administrator';


describe('Unit Tests', function() {
    beforeEach(function(){
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

    });

    afterEach(function() {
        AWS.restore('KMS');
        AWS.restore('SSM');
    });
    
    describe('Next state tests', function() {
        it('for Auth Logs, no paging', function(done) {
            let ctx = {
                invokedFunctionArn : ciscoduoMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            
            CiscoduoCollector.load().then(function(creds) {
                var collector = new CiscoduoCollector(ctx, creds);
                const curState = {
                    duo_endpoint: DUO_ENDPOINT_AUTH,
                    mintime: 1580924744000,
                    maxtime: 1580924754000,
                    poll_interval_sec: 1
                };
                
                let nextState = collector._getNextCollectionState(curState, {});
                assert.equal(DUO_ENDPOINT_AUTH, nextState.duo_endpoint);
                assert.equal(curState.maxtime, nextState.mintime);
                assert.equal(curState.maxtime + process.env.paws_poll_interval * 1000, nextState.maxtime);
                assert.equal(1, nextState.poll_interval_sec);
                done();
            });
        });

        it('for Auth Logs, with paging', function(done) {
            let ctx = {
                invokedFunctionArn : ciscoduoMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            
            CiscoduoCollector.load().then(function(creds) {
                var collector = new CiscoduoCollector(ctx, creds);
                const curState = {
                    duo_endpoint: DUO_ENDPOINT_AUTH,
                    mintime: 1580924744000,
                    maxtime: 1580924754000,
                    poll_interval_sec: 1
                };
                let nextState = collector._getNextCollectionState(curState, ciscoduoMock.AUTH_OK_RESP.response.metadata);
                assert.equal('1532951895000,af0ba235-0b33-23c8-bc23-a31aa0231de8', nextState.next_offset);
                assert.equal(curState.mintime, nextState.mintime);
                assert.equal(curState.maxtime, nextState.maxtime);
                assert.equal(1, nextState.poll_interval_sec);
                assert.equal(DUO_ENDPOINT_AUTH, nextState.duo_endpoint);
                done();
            });
        });
        
        it('for Admin Logs', function(done) {
            let ctx = {
                invokedFunctionArn : ciscoduoMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            
            CiscoduoCollector.load().then(function(creds) {
                var collector = new CiscoduoCollector(ctx, creds);
                const curState = {
                    duo_endpoint: DUO_ENDPOINT_ADMIN,
                    mintime: 1580924744,
                    poll_interval_sec: 1
                };
                const metadata = ciscoduoMock.ADMIN_OK_RESP.response[0];
                let nextState = collector._getNextCollectionState(curState, metadata);
                assert.equal(DUO_ENDPOINT_ADMIN, nextState.duo_endpoint);
                assert.equal(60, nextState.poll_interval_sec);
                assert.equal(metadata.timestamp + 1, nextState.mintime);
                done();
            });
        });
    });

    describe('Format Tests', function() {
        it('log format success AUTH logs', function(done) {
            let ctx = {
                invokedFunctionArn : ciscoduoMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            
            CiscoduoCollector.load().then(function(creds) {
                var collector = new CiscoduoCollector(ctx, creds);
                let fmt = collector.pawsFormatLog(ciscoduoMock.AUTH_OK_RESP.response.authlogs[0]);
                assert.equal('json/cisco.duo', fmt.messageType);
                assert.equal('authentication', fmt.messageTypeId);
                assert.equal(1532951962, fmt.messageTs);
                done();
            });
        });
        
        it('log format success ADMIN logs', function(done) {
            let ctx = {
                invokedFunctionArn : ciscoduoMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            
            CiscoduoCollector.load().then(function(creds) {
                var collector = new CiscoduoCollector(ctx, creds);
                let fmt = collector.pawsFormatLog(ciscoduoMock.ADMIN_OK_RESP.response[0]);
                assert.equal('json/cisco.duo', fmt.messageType);
                assert.equal('admin_login_error', fmt.messageTypeId);
                assert.equal(1446172820, fmt.messageTs);
                done();
            });
        });
    });
});
