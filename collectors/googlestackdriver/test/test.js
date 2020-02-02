const assert = require('assert');
const sinon = require('sinon');
var AWS = require('aws-sdk-mock');
const m_response = require('cfn-response');

const googlestackdriverMock = require('./googlestackdriver_mock');
var m_alCollector = require('@alertlogic/al-collector-js');
var GooglestackdriverCollector = require('../googlestackdriver_collector').GooglestackdriverCollector;
const m_al_aws = require('@alertlogic/al-aws-collector-js').Util;

describe('Unit Tests', function() {
    describe('Next state tests', function() {
        it('log format success', function(done) {
            let ctx = {
                invokedFunctionArn : googlestackdriverMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            
            GooglestackdriverCollector.load().then(function(creds) {
                var collector = new GooglestackdriverCollector(ctx, creds, 'googlestackdriver');
                let nextState = collector._getNextCollectionState(googlestackdriverMock.LOG_EVENT);
                console.log('!!!', fmt);
                // put some assertions on you next state here
                done();
            });
        });
    });

    describe('Format Tests', function() {
        it('log format success', function(done) {
            let ctx = {
                invokedFunctionArn : googlestackdriverMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            
            GooglestackdriverCollector.load().then(function(creds) {
                var collector = new GooglestackdriverCollector(ctx, creds, 'googlestackdriver');
                let fmt = collector.pawsFormatLog(googlestackdriverMock.LOG_EVENT);
                console.log('!!!', fmt);
                // put some assertions on your formatted message here
                done();
            });
        });
    });
});
