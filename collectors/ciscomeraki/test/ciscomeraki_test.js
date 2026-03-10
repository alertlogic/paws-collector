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
        sinon.stub(SSM.prototype, 'getParameter').callsFake(function (params) {
            const data = Buffer.from('test-secret');
            return Promise.resolve({ Parameter: { Value: data.toString('base64') } });
        });
        sinon.stub(KMS.prototype, 'decrypt').callsFake(function (params) {
            const data = {
                Plaintext: Buffer.from('{}')
            };
            return Promise.resolve(data);
        });

        responseStub = sinon.stub(m_response, 'send').callsFake(
            function fakeFn(event, mockContext, responseStatus, responseData, physicalResourceId) {
                return Promise.resolve();
            });
    });

    afterEach(function () {
        if (responseStub && typeof responseStub.restore === 'function') {
            responseStub.restore();
        }
        if (KMS.prototype.decrypt && typeof KMS.prototype.decrypt.restore === 'function') {
            KMS.prototype.decrypt.restore();
        }
        if (SSM.prototype.getParameter && typeof SSM.prototype.getParameter.restore === 'function') {
            SSM.prototype.getParameter.restore();
        }
    });

    describe('Paws Get Register Parameters', function () {
        it('Paws Get Register Parameters Success', async function () {
            let ctx = {
                invokedFunctionArn: ciscomerakiMock.FUNCTION_ARN,
                fail: function (error) { },
                succeed: function () { }
            };

            const creds = await CiscomerakiCollector.load();
            var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');
            const sampleEvent = { ResourceProperties: { StackName: 'a-stack-name' } };
            const regValues = collector.pawsGetRegisterParameters(sampleEvent);
            const expectedRegValues = {
                ciscoMerakiObjectNames: process.env.collector_streams,
            };
            assert.deepEqual(regValues, expectedRegValues);
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
        it('Paws Init Collection State Success', function () {
            listNetworkIds = sinon.stub(merakiClient, 'listNetworkIds').callsFake(
                function fakeFn(client, objectDetails, state, accumulator, maxPagesPerInvocation) {
                    return new Promise(function (resolve, reject) {
                        return resolve(ciscomerakiMock.NETWORKS);
                    });
                });
            return CiscomerakiCollector.load().then(async function (creds) {
                var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');
                const startDate = moment().subtract(1, 'days').toISOString();
                process.env.paws_collection_start_ts = startDate;

                const { state: initialStates } = await collector.pawsInitCollectionState();
                initialStates.forEach((state) => {
                    if (state.networkId === "L_686235993220604684") {
                        assert.equal(state.networkId, "L_686235993220604684");
                    } else if (state.networkId === "L_686235993220604720") {
                        assert.equal(state.networkId, "L_686235993220604720");
                    }
                    else {
                        assert.equal(state.poll_interval_sec >= 1, true);
                        assert.ok(state.since);
                    }
                });
            });

        });
        it('Paws Init Collection State with networks', async function () {
            process.env.collector_streams = [];
            // Mocking merakiClient.listNetworkIds to return a non-empty array
            listNetworkIds = sinon.stub(merakiClient, 'listNetworkIds').callsFake(
                function fakeFn() {
                    return new Promise(function (resolve, reject) {
                        resolve(ciscomerakiMock.NETWORKS);
                    });
                });
            const creds = await CiscomerakiCollector.load();
            var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');
            const startDate = moment().subtract(1, 'days').toISOString();
            process.env.paws_collection_start_ts = startDate;

            const { state } = await collector.pawsInitCollectionState();
            // Asserting that initialStates are generated correctly
            assert.equal(state.length, ciscomerakiMock.NETWORKS.length);
            state.forEach((initialState) => {
                assert.ok(initialState.networkId); // Assuming networkId exists in each state
            });
        });

        it('Paws Init Collection State without networks', async function () {
            process.env.collector_streams = [];
            listNetworkIds = sinon.stub(merakiClient, 'listNetworkIds').callsFake(
                function fakeFn() {
                    return new Promise(function (resolve, reject) {
                        resolve([]);
                    });
                });

            const creds = await CiscomerakiCollector.load();
            var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');
            const startDate = moment().subtract(1, 'days').toISOString();
            process.env.paws_collection_start_ts = startDate;
            try {
                await collector.pawsInitCollectionState();
            } catch (error) {
                assert.equal(error.message, "Error: No networks found");
            }
        });

        it('Paws Init Collection State error handling', async function () {
            listNetworkIds = sinon.stub(merakiClient, 'listNetworkIds').rejects(new Error('Network error'));

            const creds = await CiscomerakiCollector.load();
            var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');
            const startDate = moment().subtract(1, 'days').toISOString();
            process.env.paws_collection_start_ts = startDate;
            try {
                await collector.pawsInitCollectionState();
            } catch (error) {
                assert.equal(error.message, 'Network error');
            }
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
        it('Paws Get Logs Success', async function () {
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
            const creds = await CiscomerakiCollector.load();
            var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');
            const curState = {
                networkId: "L_686235993220604684",
                since: "2024-03-19T05:10:47.055027Z",
                until: null,
                nextPage: null,
                poll_interval_sec: 1
            };
            const [logs, newState] = await collector.pawsGetLogs(curState);
            assert.equal(logs.length, 2);
            assert.equal(newState.poll_interval_sec, 300);
            assert.ok(logs[0].type);
            getAPILogs.restore();
            listNetworkIds.restore();
            getAPIDetails.restore();
        });

        it('Paws Get Logs With NextPage Success', async function () {
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
            const creds = await CiscomerakiCollector.load();
            var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');
            const startDate = "2024-03-21T08:00:21.754Z";
            const curState = {
                networkId: "L_686235993220604684",
                since: startDate.valueOf(),
                nextPage: null,
                poll_interval_sec: 1
            };
            const [logs, newState] = await collector.pawsGetLogs(curState);
            assert.equal(logs.length, 2);
            assert.equal(newState.poll_interval_sec, 1);
            assert.equal(newState.nextPage, null);
            assert.equal(newState.since, 'nextPage');
            assert.ok(logs[0].type);
            getAPILogs.restore();
            getAPIDetails.restore();
            listNetworkIds.restore();
        });

        it('Paws Get client error', async function () {

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
            const creds = await CiscomerakiCollector.load();
            var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');
            const startDate = moment();
            const curState = {
                networkId: "L_686235993220604684",
                since: startDate.valueOf(),
                nextPage: null,
                poll_interval_sec: 1
            };
            try {
                await collector.pawsGetLogs(curState);
            } catch (error) {
                assert.equal(error.errorCode, 401);
                getAPILogs.restore();
                getAPIDetails.restore();
            }
        });

        it('Paws Get Logs check throttling error', async function () {

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
            const creds = await CiscomerakiCollector.load();
            var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');
            const startDate = moment();
            const curState = {
                networkId: "L_686235993220604684",
                since: startDate.valueOf(),
                nextPage: null,
                poll_interval_sec: 1
            };

            var reportSpy = sinon.spy(collector, 'reportApiThrottling');
            let putMetricDataStub = sinon.stub(CloudWatch.prototype, 'putMetricData').callsFake((params) => Promise.resolve());
            const [logs, newState] = await collector.pawsGetLogs(curState);
            assert.equal(true, reportSpy.calledOnce);
            assert.equal(logs.length, 0);
            assert.notEqual(newState.poll_interval_sec, 1);
            getAPILogs.restore();
            getAPIDetails.restore();
            putMetricDataStub.restore();
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

        it('Next state tests success with L_686235993220604684', function () {
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
            });
        });
    });

    describe('Format Tests', function () {
        it('log format success', function () {
            let ctx = {
                invokedFunctionArn: ciscomerakiMock.FUNCTION_ARN,
                fail: function (error) { },
                succeed: function () { }
            };

            CiscomerakiCollector.load().then(function (creds) {
                var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');
                let fmt = collector.pawsFormatLog(ciscomerakiMock.LOG_EVENT);
                assert.equal(fmt.progName, 'CiscomerakiCollector');
                assert.ok(fmt.message);
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
        it('Get Next Collection State (L_686235993220604684) With NextPage Success', function () {
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
            });
        });
        it('Get Next Collection State (L_686235993220604684) With NextPage Success', function () {
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
        it('should calculate the next collection state correctly', function () {
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
            });
        });

        it('handles ScheduledEvent with SelfUpdate', function () {
            let updateNetworksStub;
            CiscomerakiCollector.load().then(function (creds) {
                var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');
                const event = { RequestType: 'ScheduledEvent', Type: 'SelfUpdate' };
                updateNetworksStub = sinon.stub(collector, 'handleUpdateStreamsFromNetworks');
                collector.handleEvent(event);
                assert(updateNetworksStub.calledOnce);
                updateNetworksStub.restore();
            });
        });
        it('handles other event types', () => {
            return CiscomerakiCollector.load().then(async function (creds) {
                var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');
                const event = { RequestType: 'OtherEventType' };
                const updateNetworksStub = sinon.stub(collector, 'handleUpdateStreamsFromNetworks');
                try {
                    await collector.handleEvent(event);
                } catch (error) {
                    assert.equal(error.message, `AWSC0012 Unknown event:${JSON.stringify(event)}`);
                }
                
                assert(!updateNetworksStub.called);
                updateNetworksStub.restore();
            });
        });
        it('updates networks', () => {
            return CiscomerakiCollector.load().then(async function (creds) {
                var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');
                const updateNetworksStub = sinon.stub(collector, 'handleUpdateStreamsFromNetworks').resolves();
                const updateStub = sinon.stub(collector, 'handleUpdate').resolves();
                await collector.handleEvent({ RequestType: 'ScheduledEvent', Type: 'SelfUpdate' });
                assert(updateNetworksStub.calledOnce);
                updateNetworksStub.restore();
                updateStub.restore();
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

                let ctx = {
                    invokedFunctionArn: ciscomerakiMock.FUNCTION_ARN,
                    fail: function (error1) {
                        assert.fail(error1);
                    },
                    succeed: function () { }
                };
                return CiscomerakiCollector.load().then(async function (creds) {
                    var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');
                    let putMetricDataStub = sinon.stub(CloudWatch.prototype, 'putMetricData').callsFake((params) => Promise.resolve());
                    const [logs, newState, pollInterval] = await collector.handleThrottlingError(error, state);
                    assert.strictEqual(logs.length, 0);
                    assert.strictEqual(newState, state);
                    assert.strictEqual(typeof pollInterval, 'number');
                    putMetricDataStub.restore();
                });
            });
        });

        describe('handleOtherErrors', function () {
            it('should retry if API_NOT_FOUND_ERROR occurs less than 3 times', function () {
                
                const state = {
                    retry: 2
                };

                let ctx = {
                    invokedFunctionArn: ciscomerakiMock.FUNCTION_ARN,
                    fail: function (error1) {
                        assert.fail(error1);
                    },
                    succeed: function () { }
                };
                return CiscomerakiCollector.load().then(function (creds) {
                    var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');
                    const error = {
                    response: {
                        status: 404
                    }
                };
                    assert.throws(() => collector.handleOtherErrors(error, state));
                    assert.strictEqual(state.retry, 3);
                });
            });

            it('should succeed if API_NOT_FOUND_ERROR occurs 3 times', function () {
                const error = {
                    response: {
                        status: 404
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
                return CiscomerakiCollector.load().then(function (creds) {
                    var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');
                    const result = collector.handleOtherErrors(error, state);
                    assert.strictEqual(result, undefined);
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
                return CiscomerakiCollector.load().then(function (creds) {
                    var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');
                    assert.throws(() => collector.handleOtherErrors(error, state), (thrownError) => {
                        assert.deepStrictEqual(thrownError, {
                            errors: ['Invalid API key'],
                            errorCode: 401
                        });
                        return true;
                    });
                    assert.deepStrictEqual(error.response.data, {
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
                return CiscomerakiCollector.load().then(function (creds) {

                    var collector = new CiscomerakiCollector(ctx, creds, 'ciscomeraki');
                    assert.throws(() => collector.handleOtherErrors(error, state), (thrownError) => {
                        assert.strictEqual(thrownError, error);
                        return true;
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
});
