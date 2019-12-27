const assert = require('assert');
const sinon = require('sinon');
var AWS = require('aws-sdk-mock');
const m_response = require('cfn-response');

const gsuiteMock = require('./gsuite_mock');
var m_alCollector = require('@alertlogic/al-collector-js');
var GsuiteCollector = require('../gsuite_collector').GsuiteCollector;
const m_al_aws = require('@alertlogic/al-aws-collector-js').Util;

describe('Unit Tests', function() {
    describe('Next state tests', function() {
        it('log format success', function(done) {
            let ctx = {
                invokedFunctionArn : gsuiteMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            
            GsuiteCollector.load().then(function(creds) {
                var collector = new GsuiteCollector(ctx, creds, 'gsuite');
                let nextState = collector._getNextCollectionState(gsuiteMock.LOG_EVENT);
                console.log('!!!', fmt);
                // put some assertions on you next state here
                done();
            });
        });
    });

    describe('Format Tests', function() {
        it('log format success', function(done) {
            let ctx = {
                invokedFunctionArn : gsuiteMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            
            GsuiteCollector.load().then(function(creds) {
                var collector = new GsuiteCollector(ctx, creds, 'gsuite');
                let fmt = collector.pawsFormatLog(gsuiteMock.LOG_EVENT);
                console.log('!!!', fmt);
                // put some assertions on your formatted message here
                done();
            });
        });
    });
});
