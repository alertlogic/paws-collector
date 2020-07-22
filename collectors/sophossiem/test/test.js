const assert = require('assert');
const sinon = require('sinon');
var AWS = require('aws-sdk-mock');
const m_response = require('cfn-response');

const sophossiemMock = require('./sophossiem_mock');
var m_alCollector = require('@alertlogic/al-collector-js');
var SophossiemCollector = require('../sophossiem_collector').SophossiemCollector;
const m_al_aws = require('@alertlogic/al-aws-collector-js').Util;

describe('Unit Tests', function() {
    describe('Next state tests', function() {
        it('log format success', function(done) {
            let ctx = {
                invokedFunctionArn : sophossiemMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            
            SophossiemCollector.load().then(function(creds) {
                var collector = new SophossiemCollector(ctx, creds, 'sophossiem');
                let nextState = collector._getNextCollectionState(sophossiemMock.LOG_EVENT);
                console.log('!!!', fmt);
                // put some assertions on you next state here
                done();
            });
        });
    });

    describe('Format Tests', function() {
        it('log format success', function(done) {
            let ctx = {
                invokedFunctionArn : sophossiemMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            
            SophossiemCollector.load().then(function(creds) {
                var collector = new SophossiemCollector(ctx, creds, 'sophossiem');
                let fmt = collector.pawsFormatLog(sophossiemMock.LOG_EVENT);
                console.log('!!!', fmt);
                // put some assertions on your formatted message here
                done();
            });
        });
    });
});
