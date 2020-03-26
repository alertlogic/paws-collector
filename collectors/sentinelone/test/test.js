const assert = require('assert');
const sinon = require('sinon');
var AWS = require('aws-sdk-mock');
const m_response = require('cfn-response');

const sentineloneMock = require('./sentinelone_mock');
var m_alCollector = require('@alertlogic/al-collector-js');
var SentineloneCollector = require('../sentinelone_collector').SentineloneCollector;
const m_al_aws = require('@alertlogic/al-aws-collector-js').Util;

describe('Unit Tests', function() {
    describe('Next state tests', function() {
        it('log format success', function(done) {
            let ctx = {
                invokedFunctionArn : sentineloneMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            
            SentineloneCollector.load().then(function(creds) {
                var collector = new SentineloneCollector(ctx, creds, 'sentinelone');
                let nextState = collector._getNextCollectionState(sentineloneMock.LOG_EVENT);
                console.log('!!!', fmt);
                // put some assertions on you next state here
                done();
            });
        });
    });

    describe('Format Tests', function() {
        it('log format success', function(done) {
            let ctx = {
                invokedFunctionArn : sentineloneMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            
            SentineloneCollector.load().then(function(creds) {
                var collector = new SentineloneCollector(ctx, creds, 'sentinelone');
                let fmt = collector.pawsFormatLog(sentineloneMock.LOG_EVENT);
                console.log('!!!', fmt);
                // put some assertions on your formatted message here
                done();
            });
        });
    });
});
