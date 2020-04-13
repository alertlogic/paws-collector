const assert = require('assert');
const sinon = require('sinon');
var AWS = require('aws-sdk-mock');
const m_response = require('cfn-response');

const ciscoampMock = require('./ciscoamp_mock');
var m_alCollector = require('@alertlogic/al-collector-js');
var CiscoampCollector = require('../ciscoamp_collector').CiscoampCollector;
const m_al_aws = require('@alertlogic/al-aws-collector-js').Util;

describe('Unit Tests', function() {
    describe('Next state tests', function() {
        it('log format success', function(done) {
            let ctx = {
                invokedFunctionArn : ciscoampMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            
            CiscoampCollector.load().then(function(creds) {
                var collector = new CiscoampCollector(ctx, creds, 'ciscoamp');
                let nextState = collector._getNextCollectionState(ciscoampMock.LOG_EVENT);
                console.log('!!!', fmt);
                // put some assertions on you next state here
                done();
            });
        });
    });

    describe('Format Tests', function() {
        it('log format success', function(done) {
            let ctx = {
                invokedFunctionArn : ciscoampMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            
            CiscoampCollector.load().then(function(creds) {
                var collector = new CiscoampCollector(ctx, creds, 'ciscoamp');
                let fmt = collector.pawsFormatLog(ciscoampMock.LOG_EVENT);
                console.log('!!!', fmt);
                // put some assertions on your formatted message here
                done();
            });
        });
    });
});
