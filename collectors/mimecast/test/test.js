const assert = require('assert');
const sinon = require('sinon');
var AWS = require('aws-sdk-mock');
const m_response = require('cfn-response');

const mimecastMock = require('./mimecast_mock');
var m_alCollector = require('@alertlogic/al-collector-js');
var MimecastCollector = require('../mimecast_collector').MimecastCollector;
const m_al_aws = require('@alertlogic/al-aws-collector-js').Util;

describe('Unit Tests', function() {
    describe('Next state tests', function() {
        it('log format success', function(done) {
            let ctx = {
                invokedFunctionArn : mimecastMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            
            MimecastCollector.load().then(function(creds) {
                var collector = new MimecastCollector(ctx, creds, 'mimecast');
                let nextState = collector._getNextCollectionState(mimecastMock.LOG_EVENT);
                console.log('!!!', fmt);
                // put some assertions on you next state here
                done();
            });
        });
    });

    describe('Format Tests', function() {
        it('log format success', function(done) {
            let ctx = {
                invokedFunctionArn : mimecastMock.FUNCTION_ARN,
                fail : function(error) {
                    assert.fail(error);
                    done();
                },
                succeed : function() {
                    done();
                }
            };
            
            MimecastCollector.load().then(function(creds) {
                var collector = new MimecastCollector(ctx, creds, 'mimecast');
                let fmt = collector.pawsFormatLog(mimecastMock.LOG_EVENT);
                console.log('!!!', fmt);
                // put some assertions on your formatted message here
                done();
            });
        });
    });
});
