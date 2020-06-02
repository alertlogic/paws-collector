const assert = require('assert');
const sinon = require('sinon');
var AWS = require('aws-sdk-mock');
const m_response = require('cfn-response');

const ciscoduoMock = require('./ciscoduo_mock');
var m_alCollector = require('@alertlogic/al-collector-js');
var CiscoduoCollector = require('../ciscoduo_collector').CiscoduoCollector;
const m_al_aws = require('@alertlogic/al-aws-collector-js').Util;

describe('Unit Tests', function() {
    describe('Next state tests', function() {
        it('log format success', function(done) {
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
                var collector = new CiscoduoCollector(ctx, creds, 'ciscoduo');
                let nextState = collector._getNextCollectionState(ciscoduoMock.LOG_EVENT);
                console.log('!!!', fmt);
                // put some assertions on you next state here
                done();
            });
        });
    });

    describe('Format Tests', function() {
        it('log format success', function(done) {
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
                var collector = new CiscoduoCollector(ctx, creds, 'ciscoduo');
                let fmt = collector.pawsFormatLog(ciscoduoMock.LOG_EVENT);
                console.log('!!!', fmt);
                // put some assertions on your formatted message here
                done();
            });
        });
    });
});
