const assert = require('assert');
const sinon = require('sinon');
var AWS = require('aws-sdk-mock');
const m_response = require('cfn-response');

const carbonblackMock = require('./carbonblack_mock');
var m_alCollector = require('@alertlogic/al-collector-js');
var CarbonblackCollector = require('../carbonblack_collector').CarbonblackCollector;
const m_al_aws = require('@alertlogic/al-aws-collector-js').Util;

describe('Unit Tests', function() {
    describe('Next state tests', function() {
        it('log format success', function(done) {
            let ctx = {
                invokedFunctionArn : carbonblackMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            
            CarbonblackCollector.load().then(function(creds) {
                var collector = new CarbonblackCollector(ctx, creds, 'carbonblack');
                let nextState = collector._getNextCollectionState(carbonblackMock.LOG_EVENT);
                console.log('!!!', fmt);
                // put some assertions on you next state here
                done();
            });
        });
    });

    describe('Format Tests', function() {
        it('log format success', function(done) {
            let ctx = {
                invokedFunctionArn : carbonblackMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            
            CarbonblackCollector.load().then(function(creds) {
                var collector = new CarbonblackCollector(ctx, creds, 'carbonblack');
                let fmt = collector.pawsFormatLog(carbonblackMock.LOG_EVENT);
                console.log('!!!', fmt);
                // put some assertions on your formatted message here
                done();
            });
        });
    });
});
