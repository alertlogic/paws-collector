const assert = require('assert');
const sinon = require('sinon');
var AWS = require('aws-sdk-mock');
const m_response = require('cfn-response');

const sophosMock = require('./sophos_mock');
var m_alCollector = require('@alertlogic/al-collector-js');
var SophosCollector = require('../sophos_collector').SophosCollector;
const m_al_aws = require('@alertlogic/al-aws-collector-js').Util;

describe('Unit Tests', function() {
    describe('Next state tests', function() {
        it('log format success', function(done) {
            let ctx = {
                invokedFunctionArn : sophosMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            
            SophosCollector.load().then(function(creds) {
                var collector = new SophosCollector(ctx, creds, 'sophos');
                let nextState = collector._getNextCollectionState(sophosMock.LOG_EVENT);
                console.log('!!!', fmt);
                // put some assertions on you next state here
                done();
            });
        });
    });

    describe('Format Tests', function() {
        it('log format success', function(done) {
            let ctx = {
                invokedFunctionArn : sophosMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            
            SophosCollector.load().then(function(creds) {
                var collector = new SophosCollector(ctx, creds, 'sophos');
                let fmt = collector.pawsFormatLog(sophosMock.LOG_EVENT);
                console.log('!!!', fmt);
                // put some assertions on your formatted message here
                done();
            });
        });
    });
});
