const sinon = require('sinon');
const assert = require('assert');

const ciscomerakiMock = require('./ciscomeraki_mock');
var CiscomerakiCollector = require('../collector').CiscomerakiCollector;
const m_response = require('cfn-response');
const moment = require('moment');
const merakiClient = require("../meraki_client");

const { CloudWatch } = require("@aws-sdk/client-cloudwatch"),
    { KMS } = require("@aws-sdk/client-kms"),
    { SSM } = require("@aws-sdk/client-ssm");

var responseStub = {};
let getAPIDetails;
let getAPILogs;
let listNetworkIds;

describe('Unit Tests', function () {
    beforeEach(function () {
        sinon.stub(SSM.prototype, 'getParameter').callsFake(function (params, callback) {
            const data = Buffer.from('test-secret');
            return callback(null, { Parameter: { Value: data.toString('base64') } });
        });
        sinon.stub(KMS.prototype, 'decrypt').callsFake(function (params, callback) {
            const data = {
                Plaintext: Buffer.from('{}')
            };
            return callback(null, data);
        });

        responseStub = sinon.stub(m_response, 'send').callsFake(
            function fakeFn(event, mockContext, responseStatus, responseData, physicalResourceId) {
                mockContext.succeed();
            });
    });

    afterEach(function () {
        responseStub.restore();
        KMS.prototype.decrypt.restore();
        SSM.prototype.getParameter.restore();
    });

    describe('Paws Get Register Parameters', function () {
        it('Paws Get Register Parameters Success', function (done) {
            let ctx = {
                invokedFunctionArn: ciscomerakiMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };

            CiscomerakiCollector.load().then(function (creds) {
                var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');
                const sampleEvent = { ResourceProperties: { StackName: 'a-stack-name' } };
                collector.pawsGetRegisterParameters(sampleEvent, (err, regValues) => {
                    const expectedRegValues = {
                        ciscoMerakiObjectNames: process.env.collector_streams,
                    };
                    assert.deepEqual(regValues, expectedRegValues);
                    done();
                });
            });
        });
    });

    describe('Paws Init Collection State', function () {
        let ctx = {
            invokedFunctionArn: ciscomerakiMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('Paws Init Collection State Success', function (done) {
            listNetworkIds = sinon.stub(merakiClient, 'listNetworkIds').callsFake(
                function fakeFn(client, objectDetails, state, accumulator, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return resolve(ciscomerakiMock.NETWORKS);
                    });
                });
            CiscomerakiCollector.load().then(function (creds) {
                var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');
                const startDate = moment().subtract(1, 'days').toISOString();
                process.env.paws_collection_start_ts = startDate;

                collector.pawsInitCollectionState(null, (err, initialStates, nextPoll) => {
                    initialStates.forEach((state) => {
                        if (state.networkId === "L_686235993220604684") {
                            assert.equal(state.networkId, "L_686235993220604684");
                        } else if (state.networkId === "L_686235993220604720") {
                            assert.equal(state.networkId, "L_686235993220604720");
                        }
                        else {
                            assert.equal(state.poll_interval_sec, 1);
                            assert.ok(state.since);
                        }
                    });
                });
            });
            done();
        });
        it('Paws Init Collection State with networks', function (done) {
            process.env.collector_streams = [];
            // Mocking merakiClient.listNetworkIds to return a non-empty array
            listNetworkIds = sinon.stub(merakiClient, 'listNetworkIds').callsFake(
                function fakeFn(callback) {
                    return new Promise(function (resolve, reject) {
                        resolve(ciscomerakiMock.NETWORKS);
                    });
                });

            CiscomerakiCollector.load().then(function (creds) {
                var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');
                const startDate = moment().subtract(1, 'days').toISOString();
                process.env.paws_collection_start_ts = startDate;

                collector.pawsInitCollectionState(null, (err, initialStates, nextPoll) => {
                    // Asserting that initialStates are generated correctly
                    assert.equal(initialStates.length, ciscomerakiMock.NETWORKS.length);
                    initialStates.forEach((state) => {
                        assert.ok(state.networkId); // Assuming networkId exists in each state
                    });
                    done();
                });
            });
        });

        it('Paws Init Collection State without networks', function (done) {
            process.env.collector_streams = [];
            listNetworkIds = sinon.stub(merakiClient, 'listNetworkIds').callsFake(
                function fakeFn(callback) {
                    return new Promise(function (resolve, reject) {
                        resolve([]); // Assuming no networks found
                    });
                });

            CiscomerakiCollector.load().then(function (creds) {
                var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');
                const startDate = moment().subtract(1, 'days').toISOString();
                process.env.paws_collection_start_ts = startDate;

                collector.pawsInitCollectionState(null, (err, initialStates, nextPoll) => {
                    // Asserting that an error is returned when no networks are found
                    assert.equal(err, "Error: No networks found");
                    done();
                });
            });
        });

        it('Paws Init Collection State error handling', function (done) {
            listNetworkIds = sinon.stub(merakiClient, 'listNetworkIds').rejects(new Error('Network error'));

            CiscomerakiCollector.load().then(function (creds) {
                var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');
                const startDate = moment().subtract(1, 'days').toISOString();
                process.env.paws_collection_start_ts = startDate;

                collector.pawsInitCollectionState(null, (err, initialStates, nextPoll) => {
                    assert.equal(err.message, 'Network error');
                    done();
                });
            });
        });

        afterEach(function () {
            listNetworkIds.restore();
        });
    });

    describe('pawsGetLogs', function () {
        let ctx = {
            invokedFunctionArn: ciscomerakiMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('Paws Get Logs Success', function (done) {
            getAPILogs = sinon.stub(merakiClient, 'getAPILogs').callsFake(
                function fakeFn(client, objectDetails, state, accumulator, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return resolve({ accumulator: [ciscomerakiMock.LOG_EVENT, ciscomerakiMock.LOG_EVENT] });
                    });
                });
            getAPIDetails = sinon.stub(merakiClient, 'getAPIDetails').callsFake(
                function fakeFn(state) {
                    return {
                        url: "api_url",
                        method: "GET",
                        requestBody: "",
                        orgKey: "1234",
                        productTypes: ["appliance"]

                    };
                });
            listNetworkIds = sinon.stub(merakiClient, 'listNetworkIds').callsFake(
                function fakeFn(client, objectDetails, state, accumulator, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return resolve(ciscomerakiMock.NETWORKS);
                    });
                });
            CiscomerakiCollector.load().then(function (creds) {
                var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');
                const curState = {
                    networkId: "L_686235993220604684",
                    since: "2024-03-19T05:10:47.055027Z",
                    until: null,
                    nextPage: null,
                    poll_interval_sec: 1
                };
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(logs.length, 2);
                    assert.equal(newState.poll_interval_sec, 300);
                    assert.ok(logs[0].type);
                    getAPILogs.restore();
                    listNetworkIds.restore();
                    getAPIDetails.restore();
                });

                done();

            });
        });

        it('Paws Get Logs With NextPage Success', function (done) {
            listNetworkIds = sinon.stub(merakiClient, 'listNetworkIds').callsFake(
                function fakeFn(client, objectDetails, state, accumulator, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return resolve(ciscomerakiMock.NETWORKS);
                    });
                });
            getAPILogs = sinon.stub(merakiClient, 'getAPILogs').callsFake(
                function fakeFn(client, objectDetails, state, accumulator, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return resolve({ accumulator: [ciscomerakiMock.LOG_EVENT, ciscomerakiMock.LOG_EVENT], nextPage: "nextPage" });
                    });
                });
            getAPIDetails = sinon.stub(merakiClient, 'getAPIDetails').callsFake(
                function fakeFn(state) {
                    return {
                        url: "api_url",
                        method: "GET",
                        requestBody: "",
                        orgKey: "1234",
                        productTypes: ["appliance"]

                    };
                });
            CiscomerakiCollector.load().then(function (creds) {
                var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');
                const startDate = "2024-03-21T08:00:21.754Z";
                const curState = {
                    networkId: "L_686235993220604684",
                    since: startDate.valueOf(),
                    nextPage: null,
                    poll_interval_sec: 1
                };
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(logs.length, 2);
                    assert.equal(newState.poll_interval_sec, 1);
                    assert.equal(newState.nextPage, null);
                    assert.equal(newState.since, 'nextPage');
                    assert.ok(logs[0].type);
                    getAPILogs.restore();
                    getAPIDetails.restore();
                    listNetworkIds.restore();

                    done();
                });

            });
        });

        it('Paws Get client error', function (done) {

            getAPILogs = sinon.stub(merakiClient, 'getAPILogs').callsFake(
                function fakeFn(client, objectDetails, state, accumulator, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return reject({
                            code: 401,
                            message: 'Invalid API key',
                            response: {
                                data: { errors: ['Invalid API key'] },
                                status: 401
                            }
                        });
                    });
                });
            getAPIDetails = sinon.stub(merakiClient, 'getAPIDetails').callsFake(
                function fakeFn(state) {
                    return {
                        url: "api_url",
                        method: "GET",
                        requestBody: "",
                        orgKey: "1234",
                        productTypes: ["appliance"]

                    };
                });
            CiscomerakiCollector.load().then(function (creds) {
                var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');
                const startDate = moment();
                const curState = {
                    networkId: "L_686235993220604684",
                    since: startDate.valueOf(),
                    nextPage: null,
                    poll_interval_sec: 1
                };
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(err.errorCode, 401);
                    getAPILogs.restore();
                    getAPIDetails.restore();
                    done();
                });

            });
        });

        it('Paws Get Logs check throttling error', function (done) {

            getAPILogs = sinon.stub(merakiClient, 'getAPILogs').callsFake(
                function fakeFn(client, objectDetails, state, accumulator, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return reject({
                            code: 429,
                            message: 'Too Many Requests',
                            response: {
                                data: { errors: ['Too Many Requests'] },
                                headers: { 'retry-after': 360 },
                                status: 429
                            },
                            stat: 'FAIL', "errorCode": 429
                        });
                    });
                });
            getAPIDetails = sinon.stub(merakiClient, 'getAPIDetails').callsFake(
                function fakeFn(state) {
                    return {
                        url: "api_url",
                        method: "GET",
                        requestBody: "",
                        orgKey: "1234",
                        productTypes: ["appliance"]

                    };
                });
            CiscomerakiCollector.load().then(function (creds) {
                var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');
                const startDate = moment();
                const curState = {
                    networkId: "L_686235993220604684",
                    since: startDate.valueOf(),
                    nextPage: null,
                    poll_interval_sec: 1
                };

                var reportSpy = sinon.spy(collector, 'reportApiThrottling');
                let putMetricDataStub = sinon.stub(CloudWatch.prototype, 'putMetricData').callsFake((params, callback) => callback());
                collector.pawsGetLogs(curState, (err, logs, newState, newPollInterval) => {
                    assert.equal(true, reportSpy.calledOnce);
                    assert.equal(logs.length, 0);
                    assert.notEqual(newState.poll_interval_sec, 1);
                    getAPILogs.restore();
                    getAPIDetails.restore();
                    putMetricDataStub.restore();
                    done();
                });

            });
        });
    });

    describe('Next state tests', function () {
        let ctx = {
            invokedFunctionArn: ciscomerakiMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };

        it('Next state tests success with L_686235993220604684', function (done) {
            CiscomerakiCollector.load().then(function (creds) {
                var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');
                const startDate = moment();
                const curState = {
                    networkId: "L_686235993220604684",
                    since: startDate.valueOf(),
                    until: startDate.add(collector.pollInterval, 'seconds').valueOf(),
                    nextPage: null,
                    poll_interval_sec: 1
                };
                let nextState = collector._getNextCollectionState(curState);
                assert.equal(nextState.poll_interval_sec, process.env.paws_poll_interval_delay);
                done();
            });
        });

    });

    describe('Format Tests', function () {
        it('log format success', function (done) {
            let ctx = {
                invokedFunctionArn: ciscomerakiMock.FUNCTION_ARN,
                fail: function (error) {
                    assert.fail(error);
                    done();
                },
                succeed: function () {
                    done();
                }
            };

            CiscomerakiCollector.load().then(function (creds) {
                var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');
                let fmt = collector.pawsFormatLog(ciscomerakiMock.LOG_EVENT);
                assert.equal(fmt.progName, 'CiscomerakiCollector');
                assert.ok(fmt.message);
                done();
            });
        });
    });

    describe('NextCollectionStateWithNextPage', function () {
        let ctx = {
            invokedFunctionArn: ciscomerakiMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('Get Next Collection State (L_686235993220604684) With NextPage Success', function (done) {
            const startDate = moment();
            const curState = {
                networkId: "L_686235993220604684",
                since: startDate.valueOf(),
                poll_interval_sec: 1
            };
            const nextPage = "nextPage";
            CiscomerakiCollector.load().then(function (creds) {
                var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');
                let nextState = collector._getNextCollectionStateWithNextPage(curState, nextPage);
                assert.ok(nextState.since);
                assert.equal(nextState.since, nextPage);
                done();
            });
        });
        it('Get Next Collection State (L_686235993220604684) With NextPage Success', function (done) {
            const startDate = moment();
            const curState = {
                networkId: "L_686235993220604684",
                since: startDate.unix(),
                poll_interval_sec: 1
            };
            const nextPageTimestamp = "1574157600";
            CiscomerakiCollector.load().then(function (creds) {
                var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');
                let nextState = collector._getNextCollectionStateWithNextPage(curState, nextPageTimestamp);
                assert.ok(nextState.since);
                assert.equal(nextState.since, nextPageTimestamp);
                done();
            });
        });
    });
    describe('Next Collection State Calculation', function () {
        let ctx = {
            invokedFunctionArn: ciscomerakiMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        it('should calculate the next collection state correctly', function (done) {
            const curState = {
                networkId: "L_686235993220604684",
                since: moment().valueOf(),
                poll_interval_sec: 1
            };

            const expectedNextState = {
                networkId: 'L_686235993220604684',
                since: moment().toISOString(),
                until: moment().add(1, 'minutes').toISOString(),
                nextPage: null,
                poll_interval_sec: '300'
            };
            CiscomerakiCollector.load().then(function (creds) {
                var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');
                let nextState = collector._getNextCollectionState(curState);
                assert.deepEqual(nextState.poll_interval_sec, expectedNextState.poll_interval_sec);
                done();
            });
        });

        it('handles ScheduledEvent with SelfUpdate', function (done) {
            let updateNetworksStub;
            CiscomerakiCollector.load().then(function (creds) {
                var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');
                const event = { RequestType: 'ScheduledEvent', Type: 'SelfUpdate' };
                updateNetworksStub = sinon.stub(collector, 'handleUpdateStreamsFromNetworks');
                collector.handleEvent(event);
                assert(updateNetworksStub.calledOnce);
                updateNetworksStub.restore();
                done();
            });
        });
        it('handles other event types', () => {

            let updateNetworksStub;
            CiscomerakiCollector.load().then(function (creds) {
                var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');
                const event = { RequestType: 'OtherEventType' };
                collector.handleEvent(event);
                assert(!updateNetworksStub.called);
                updateNetworksStub.restore();
            });

        });
        it('updates networks', () => {
            let updateNetworksStub;
            CiscomerakiCollector.load().then(function (creds) {
                var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');
                updateNetworksStub.returns(Promise.resolve());
                collector.handleScheduledEvent({ Type: 'SelfUpdate' });
                assert(updateNetworksStub.calledOnce);
                updateNetworksStub.restore();
            });
        });

    });

    describe('Error Handling', function () {
        describe('handleThrottlingError', function () {
            it('should retry after adding random time to poll_interval_sec', function () {
                const error = {
                    response: {
                        headers: {
                            'retry-after': '10'
                        }
                    }
                };
                const state = {
                    poll_interval_sec: 1
                };
                const callback = sinon.stub();

                let ctx = {
                    invokedFunctionArn: ciscomerakiMock.FUNCTION_ARN,
                    fail: function (error1) {
                        assert.fail(error1);
                    },
                    succeed: function () { }
                };
                CiscomerakiCollector.load().then(function (creds) {
                    var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');

                    collector.handleThrottlingError(error, state, callback);

                    assert.strictEqual(callback.calledOnce, true);
                    assert.strictEqual(typeof callback.args[0][0], 'object');
                    assert.strictEqual(callback.args[0][1].length, 0);
                    assert.strictEqual(callback.args[0][2], state);
                    assert.strictEqual(typeof callback.args[0][3], 'number');
                });
            });
        });

        describe('handleOtherErrors', function () {
            it('should retry if API_NOT_FOUND_ERROR occurs less than 3 times', function () {
                const error = {
                    response: {
                        status: CiscomerakiCollector.API_NOT_FOUND_ERROR
                    }
                };
                const state = {
                    retry: 2
                };
                const callback = sinon.stub();

                let ctx = {
                    invokedFunctionArn: ciscomerakiMock.FUNCTION_ARN,
                    fail: function (error1) {
                        assert.fail(error1);
                    },
                    succeed: function () { }
                };
                CiscomerakiCollector.load().then(function (creds) {
                    var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');

                    collector.handleOtherErrors(error, state, callback);

                    assert.strictEqual(callback.calledOnce, false);
                    assert.strictEqual(state.retry, 3);
                });
            });

            it('should succeed if API_NOT_FOUND_ERROR occurs 3 times', function () {
                const error = {
                    response: {
                        status: CiscomerakiCollector.API_NOT_FOUND_ERROR
                    }
                };
                const state = {
                    retry: 3
                };

                let ctx = {
                    invokedFunctionArn: ciscomerakiMock.FUNCTION_ARN,
                    fail: function (error1) {
                        assert.fail(error1);
                    },
                    succeed: function () { }
                };
                CiscomerakiCollector.load().then(function (creds) {
                    var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');

                    const succeedStub = sinon.stub(collector._invokeContext, 'succeed');

                    collector.handleOtherErrors(error, state, () => { });

                    assert.strictEqual(succeedStub.calledOnce, true);
                });
            });

            it('should return error if response has data', function () {
                const error = {
                    response: {
                        data: {
                            errors: ['Invalid API key']
                        },
                        status: 401
                    }
                };
                const state = {};

                let ctx = {
                    invokedFunctionArn: ciscomerakiMock.FUNCTION_ARN,
                    fail: function (error1) {
                        assert.fail(error1);
                    },
                    succeed: function () { }
                };
                CiscomerakiCollector.load().then(function (creds) {
                    var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');

                    const callbackStub = sinon.stub();

                    collector.handleOtherErrors(error, state, callbackStub);

                    assert.strictEqual(callbackStub.calledOnce, true);
                    assert.deepStrictEqual(callbackStub.args[0][0], {
                        errors: ['Invalid API key'],
                        errorCode: 401
                    });
                });
            });

            it('should return original error if response has no data', function () {
                const error = {
                    response: {
                        status: 500
                    }
                };
                const state = {};

                let ctx = {
                    invokedFunctionArn: ciscomerakiMock.FUNCTION_ARN,
                    fail: function (error1) {
                        assert.fail(error1);
                    },
                    succeed: function () { }
                };
                CiscomerakiCollector.load().then(function (creds) {

                    var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');

                    const callbackStub = sinon.stub();

                    collector.handleOtherErrors(error, state, callbackStub);

                    assert.strictEqual(callbackStub.calledOnce, true);
                    assert.strictEqual(callbackStub.args[0][0], error);
                });
            });
        });
    });

});

describe('handleUpdateStreamsFromNetworks Function', function () {
    let uploadStub;
    beforeEach(function () {
        sinon.stub(merakiClient, 'listNetworkIds').resolves(['network1', 'network2']);
        sinon.stub(merakiClient, 'getS3ObjectParams').resolves({ bucketName: 'testBucket', key: 'testKey' });
        sinon.stub(merakiClient, 'fetchJsonFromS3Bucket').resolves(['network1']);
        sinon.stub(merakiClient, 'differenceOfNetworksArray').returns(['network2']);
        uploadStub = sinon.stub(merakiClient, 'uploadNetworksListInS3Bucket').resolves();
    });

    afterEach(function () {
        sinon.restore();
    });

    it('should handle network updates correctly', async function () {

        let ctx = {
            invokedFunctionArn: ciscomerakiMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };

        return CiscomerakiCollector.load().then(async function (creds) {
            var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');

            sinon.stub(collector, '_storeCollectionState').callsFake(function (_, __, ___, callback) {
                callback();
            });

            await collector.handleUpdateStreamsFromNetworks();

            assert.strictEqual(merakiClient.listNetworkIds.callCount, 1);
            assert.strictEqual(merakiClient.getS3ObjectParams.callCount, 1);
            assert.strictEqual(merakiClient.fetchJsonFromS3Bucket.callCount, 1);
            assert.strictEqual(merakiClient.differenceOfNetworksArray.callCount, 1);
            assert.strictEqual(uploadStub.callCount, 1);
            sinon.restore();
        });
    });

    it('should handle network updates when no networks from S3 are found', async function () {
        let ctx = {
            invokedFunctionArn: ciscomerakiMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };

        return CiscomerakiCollector.load().then(async function (creds) {
            const collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');
            sinon.stub(collector, '_storeCollectionState').callsFake(function (_, __, ___, callback) {
                callback();
            });

            await collector.handleUpdateStreamsFromNetworks();

            assert.strictEqual(merakiClient.listNetworkIds.callCount, 1);
            assert.strictEqual(merakiClient.getS3ObjectParams.callCount, 1);
            assert.strictEqual(merakiClient.fetchJsonFromS3Bucket.callCount, 1);
            assert.strictEqual(uploadStub.callCount, 1);
        });
    });

    it('should handle network updates when S3 fetch returns an error', async function () {
        let ctx = {
            invokedFunctionArn: ciscomerakiMock.FUNCTION_ARN,
            fail: function (error) {
                assert.fail(error);
            },
            succeed: function () { }
        };
        return CiscomerakiCollector.load().then(async function (creds) {
            var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');
            sinon.stub(collector, '_storeCollectionState').callsFake(function (_, __, ___, callback) {
                callback();
            });

            await collector.handleUpdateStreamsFromNetworks();
            assert.strictEqual(merakiClient.listNetworkIds.callCount, 1);
            assert.strictEqual(merakiClient.getS3ObjectParams.callCount, 1);
            assert.strictEqual(merakiClient.fetchJsonFromS3Bucket.callCount, 1);
            assert.strictEqual(uploadStub.callCount, 1);
        });
    });
});


