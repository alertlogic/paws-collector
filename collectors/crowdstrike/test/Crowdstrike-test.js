const assert = require('assert');
const sinon = require('sinon');
var AWS = require('aws-sdk-mock');
const m_response = require('cfn-response');
const crowdstrikeMock = require('./crowdstrike-mock');
var CrowdstrikeCollector = require('../collector').CrowdstrikeCollector;
const moment = require('moment');
const utils = require("../utils");

var responseStub = {};
let authenticate;
let getList;
let getAPIDetails;
let getIncidents;
let getDetections;

function setAlServiceStub() {
    authenticate = sinon.stub(utils, 'authenticate').callsFake(
        function fakeFn(baseUrl, client_id, client_secret) {
            return new Promise(function (resolve, reject) {
                return resolve(crowdstrikeMock.AUTHENTICATE.access_token);
            });
        }
    );
    getList = sinon.stub(utils, 'getList').callsFake(
        function fakeFn(apiDetails, accumulator, apiEndpoint, token) {
            return new Promise(function (resolve, reject) {
                return resolve({ accumulator: crowdstrikeMock.LIST.resources, total: 1 });
            });
        });
    getIncidents = sinon.stub(utils, 'getIncidents').callsFake(
        function fakeFn(ids, apiEndpoint, token) {
            return new Promise(function (resolve, reject) {
                return resolve({ resources: crowdstrikeMock.INCIDENT_LOG_EVENT.resources});
            });
        });
    getDetections = sinon.stub(utils, 'getDetections').callsFake(
        function fakeFn(ids, apiEndpoint, token) {
            return new Promise(function (resolve, reject) {
                return resolve({ resources: crowdstrikeMock.DETECTION_LOG_EVENT.resources});
            });
        });
    getAPIDetails = sinon.stub(utils, 'getAPIDetails').callsFake(
        function fakeFn(state) {
            return {
                url: "url",
                method: "GET",
                requestBody: "sortFieldName",
                typeIdPaths: [{ path: ["detection_id"] }],
                tsPaths: [{ path: ["created_timestamp"] }]
            };
        });

}

function restoreAlServiceStub() {
    authenticate.restore();
    getList.restore();
    getDetections.restore();
    getIncidents.restore();
    getAPIDetails.restore();
}

describe('Unit Tests', function () {

    beforeEach(function () {
        AWS.mock('SSM', 'getParameter', function (params, callback) {
            const data = new Buffer('test-secret');
            return callback(null, { Parameter: { Value: data.toString('base64') } });
        });
        AWS.mock('KMS', 'decrypt', function (params, callback) {
            const data = {
                Plaintext: '{}'
            };
            return callback(null, data);
        });
        responseStub = sinon.stub(m_response, 'send').callsFake(
            function fakeFn(event, mockContext, responseStatus, responseData, physicalResourceId) {
                mockContext.succeed();
            });
    });

    afterEach(function () {
        restoreAlServiceStub();
        responseStub.restore();
    });

    describe('Paws Init Collection State', function () {
        let ctx = {
            invokedFunctionArn: crowdstrikeMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('Paws Init Collection State Success', function (done) {
            setAlServiceStub();
            CrowdstrikeCollector.load().then(function (creds) {
                var collector = new CrowdstrikeCollector(ctx, creds, 'crowdstrike');
                const startDate = moment().subtract(1, 'days').toISOString();
                process.env.paws_collection_start_ts = startDate;

                collector.pawsInitCollectionState(null, (err, initialStates, nextPoll) => {
                    initialStates.forEach((state) => {
                        assert.equal(moment(state.until).diff(state.since, 'seconds'), 60);
                    });
                    done();
                });
            });
        });
    });

    describe('Paws Get Register Parameters', function () {
        it('Paws Get Register Parameters Success', function (done) {
            setAlServiceStub();
            let ctx = {
                invokedFunctionArn: crowdstrikeMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };

            CrowdstrikeCollector.load().then(function (creds) {
                var collector = new CrowdstrikeCollector(ctx, creds, 'crowdstrike');
                const sampleEvent = { ResourceProperties: { StackName: 'a-stack-name' } };
                collector.pawsGetRegisterParameters(sampleEvent, (err, regValues) => {
                    const expectedRegValues = {
                        crowdstrikeAPINames: '["Incident", "Detection"]'
                    };
                    assert.deepEqual(regValues, expectedRegValues);
                    done();
                });
            });
        });
    });

    describe('pawsGetLogs Success', function () {
        let ctx = {
            invokedFunctionArn: crowdstrikeMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('Paws Get Logs Success', function (done) {
            setAlServiceStub();
            CrowdstrikeCollector.load().then(function (creds) {
                var collector = new CrowdstrikeCollector(ctx, creds, 'crowdstrike');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    stream: "Detection",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    offset: 0,
                    poll_interval_sec: 1
                };

                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(logs.length, 1);
                    assert.equal(newState.poll_interval_sec, 1);
                    assert.ok(logs[0].detection_id);
                    done();
                });

            });
        });
    });

    describe('Format Tests', function () {
        it('log format success', function (done) {
            setAlServiceStub();
            let ctx = {
                invokedFunctionArn: crowdstrikeMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };

            CrowdstrikeCollector.load().then(function (creds) {
                var collector = new CrowdstrikeCollector(ctx, creds, 'crowdstrike');
                let fmt = collector.pawsFormatLog(crowdstrikeMock.DETECTION_LOG_EVENT.resources[0]);
                assert.equal(fmt.progName, 'CrowdstrikeCollector');
                assert.ok(fmt.messageType);
                done();
            });
        });
    });

    describe('NextCollectionStateWithOffset', function () {
        it('Get Next Collection State With Offset Success', function (done) {
            setAlServiceStub();
            let ctx = {
                invokedFunctionArn: crowdstrikeMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };

            const startDate = moment().subtract(5, 'minutes');
            const curState = {
                stream: "Detection",
                since: startDate.toISOString(),
                until: startDate.add(5, 'minutes').toISOString(),
                offset: 0,
                poll_interval_sec: 1
            };
            const offset = 'offset';
            const receivedAll = false;
            CrowdstrikeCollector.load().then(function (creds) {
                var collector = new CrowdstrikeCollector(ctx, creds, 'crowdstrike');
                let nextState = collector._getNextCollectionStateWithOffset(curState, offset, receivedAll);
                assert.ok(nextState.offset);
                assert.equal(nextState.offset, offset);
                done();
            });
        });
    });

    describe('pawsGetLogs get list failure', function () {
        let errorObj = {
            statusCode: 401, error: {
                notifications: null,
                success: false,
                message: 'List failure'
            }
        };
        let ctx = {
            invokedFunctionArn: crowdstrikeMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        beforeEach(function () {
            authenticate = sinon.stub(utils, 'authenticate').callsFake(
                function fakeFn(baseUrl, client_id, client_secret) {
                    return new Promise(function (resolve, reject) {
                        return resolve(crowdstrikeMock.AUTHENTICATE.access_token);
                    });
                }
            );
            getAPIDetails = sinon.stub(utils, 'getAPIDetails').callsFake(
                function fakeFn(state) {
                    return {
                        url: "url",
                        method: "GET",
                        requestBody: "sortFieldName",
                        typeIdPaths: [{ path: ["detection_id"] }],
                        tsPaths: [{ path: ["created_timestamp"] }]
                    };
                });
            getList = sinon.stub(utils, 'getList').callsFake(
                function fakeFn(apiDetails, accumulator, apiEndpoint, token) {
                    return new Promise(function (resolve, reject) {
                        return reject(errorObj);
                    });
                });
        });
        it('Paws Get List Fail', function (done) {
            CrowdstrikeCollector.load().then(function (creds) {
                var collector = new CrowdstrikeCollector(ctx, creds, 'crowdstrike');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    stream: "Detection",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    offset: 0,
                    poll_interval_sec: 1
                };
                
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(err.errorCode, errorObj.statusCode);
                    assert.equal(err.error.message, errorObj.error.message);
                    done();
                });
            });
        });
    });

    describe('pawsGetLogs get authentication failure', function () {
        let errorObj = {
            statusCode: 401, error: {
                notifications: null,
                success: false,
                message: 'Authentication failure'
            }
        };
        let ctx = {
            invokedFunctionArn: crowdstrikeMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        beforeEach(function () {
            authenticate = sinon.stub(utils, 'authenticate').callsFake(
                function fakeFn(baseUrl, client_id, client_secret) {
                    return new Promise(function (resolve, reject) {
                        return reject(errorObj);
                    });
                }
            );
        });
        it('Authentication Fail', function (done) {
            CrowdstrikeCollector.load().then(function (creds) {
                var collector = new CrowdstrikeCollector(ctx, creds, 'crowdstrike');
                const startDate = moment().subtract(3, 'days');
                const curState = {
                    stream: "Detection",
                    since: startDate.toISOString(),
                    until: startDate.add(2, 'days').toISOString(),
                    offset: 0,
                    poll_interval_sec: 1
                };
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(err.errorCode, errorObj.statusCode);
                    assert.equal(err.error.message, errorObj.error.message);
                    done();
                });
            });
        });
    });
});
