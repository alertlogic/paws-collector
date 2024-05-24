const sinon = require('sinon');
const assert = require('assert');
const axios = require('axios');
const ciscomerakiMock = require('./ciscomeraki_mock');
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;
const AlAwsUtil = require('@alertlogic/al-aws-collector-js').Util;
const { getAPILogs, makeApiCall, getAllNetworks, fetchAllNetworks, getAPIDetails,
    fetchJsonFromS3Bucket, differenceOfNetworksArray, getOrgKeySecretEndPoint, getS3ObjectParams, uploadToS3Bucket } = require('../utils');
const { S3Client } = require("@aws-sdk/client-s3");

describe('API Tests', function () {
    let axiosGetStub;

    beforeEach(function () {
        axiosGetStub = sinon.stub(axios, 'get');
    });

    afterEach(function () {
        axiosGetStub.restore();
    });

    describe('getAPILogs', function () {
        it('should accumulate data from multiple pages', async function () {
            axiosGetStub.onFirstCall().returns(Promise.resolve({
                data: { events: [ciscomerakiMock.LOG_EVENT, ciscomerakiMock.LOG_EVENT], pageEndAt: '2024-04-15T10:00:00Z' },
                headers: { link: '<https://api.meraki.com/next>; rel=next' }
            }));
            axiosGetStub.onSecondCall().returns(Promise.resolve({
                data: { events: [ciscomerakiMock.LOG_EVENT, ciscomerakiMock.LOG_EVENT], pageEndAt: '2024-04-15T11:00:00Z' },
                headers: {}
            }));

            const apiDetails = { productTypes: ['appliance', 'switch'] };
            const accumulator = [];
            const apiEndpoint = 'api.meraki.com';
            const state = { since: '2024-04-14T00:00:00Z', networkId: 'L_686235993220604684' };
            const clientSecret = 'your-secret';
            const maxPagesPerInvocation = 2;

            const result = await getAPILogs(apiDetails, accumulator, apiEndpoint, state, clientSecret, maxPagesPerInvocation);

            assert.deepStrictEqual(result.accumulator, [ciscomerakiMock.LOG_EVENT, ciscomerakiMock.LOG_EVENT, ciscomerakiMock.LOG_EVENT, ciscomerakiMock.LOG_EVENT]);
            assert.strictEqual(result.nextPage, undefined);
        });
    });

    describe('makeApiCall', function () {
        it('should return response data', async function () {
            let url = 'https://api.meraki.com/network/L_686235993220604684/events';
            const apiKey = 'your-api-key';
            const perPage = 10;
            const startingAfter = null;

            axiosGetStub.returns(Promise.resolve({
                data: { events: [ciscomerakiMock.LOG_EVENT, ciscomerakiMock.LOG_EVENT] },
                headers: {}
            }));

            const response = await makeApiCall(url, apiKey, perPage, startingAfter);

            assert.deepStrictEqual(response.data.events, [ciscomerakiMock.LOG_EVENT, ciscomerakiMock.LOG_EVENT]);
        });
    });

    describe('fetchAllNetworks', function () {
        it('should return network data', async function () {
            const url = '/api/v1/networks';
            const apiKey = 'your-api-key';
            const apiEndpoint = 'api.meraki.com';

            axiosGetStub.returns(Promise.resolve({
                data: { networks: ['L_686235993220604684', 'L_686235993220604685'] },
                headers: {}
            }));

            const networks = await fetchAllNetworks(url, apiKey, apiEndpoint);

            assert.deepStrictEqual(networks.networks, ['L_686235993220604684', 'L_686235993220604685']);
        });
    });

    describe('getAPIDetails', function () {
        it('should return correct API details', function () {
            const orgKey = 'your-org-key';
            const productTypes = ['appliance', 'switch'];

            const apiDetails = getAPIDetails(orgKey, productTypes);

            assert.strictEqual(apiDetails.url, '/api/v1/networks');
            assert.strictEqual(apiDetails.method, 'GET');
            assert.strictEqual(apiDetails.requestBody, '');
            assert.strictEqual(apiDetails.orgKey, orgKey);
            assert.deepStrictEqual(apiDetails.productTypes, productTypes);
        });
    });

    describe('Error Handling', function () {
        it('should handle network errors gracefully', async function () {
            axiosGetStub.rejects(new Error('Network error'));
            try {
                await makeApiCall('https://api.meraki.com/network/L_686235993220604684/events', 'your-api-key', 10);
            } catch (error) {
                assert.equal(error.message, 'Network error');
            }
        });
    });

    describe('Pagination Handling', function () {
        it('should correctly handle the last page of results', async function () {
            const apiDetails = { productTypes: ['appliance', 'switch'] };
            const apiEndpoint = 'api.meraki.com';
            const state = { since: '2024-04-14T00:00:00Z', networkId: 'L_686235993220604684' };
            const clientSecret = 'your-secret';
            const maxPagesPerInvocation = 2;
            // Assuming you have a way to track the number of calls to axios.get
            let callCount = 0;
            axiosGetStub.callsFake(function () {
                callCount++;
                if (callCount === 1) {
                    return Promise.resolve({
                        data: { events: [ciscomerakiMock.LOG_EVENT, ciscomerakiMock.LOG_EVENT], pageEndAt: '2024-04-16T10:00:00Z' },
                        headers: {}
                    });
                } else if (callCount === 2) {
                    return Promise.resolve({
                        data: { events: [ciscomerakiMock.LOG_EVENT, ciscomerakiMock.LOG_EVENT], pageEndAt: '2024-04-16T10:00:00Z' },
                        headers: {}
                    });
                } else {
                    return Promise.resolve({
                        data: { events: [] },
                        headers: {}
                    });
                }
            });

            const result = await getAPILogs(apiDetails, [], apiEndpoint, state, clientSecret, maxPagesPerInvocation);
            const mockResults = { nextPage: undefined, accumulator: [ciscomerakiMock.LOG_EVENT, ciscomerakiMock.LOG_EVENT, ciscomerakiMock.LOG_EVENT, ciscomerakiMock.LOG_EVENT] };
            assert.equal(result.accumulator.length, mockResults.accumulator.length);
            assert.equal(result.nextPage, mockResults.nextPage);
        });
    });

    describe('Rate Limiting', function () {
        it('should apply exponential backoff on rate limit errors', async function () {
            axiosGetStub.rejects({ response: { status: 429 } });
            const attemptApiCall = getAllNetworks('/api/v1/networks', 'your-api-key', 'api.meraki.com');
            attemptApiCall.catch((error) => {
                assert.include(error.message, '429');
            });
        });
    });

    describe('API Details Functionality', function () {
        it('should construct correct API details for different orgKey and productTypes', function () {
            const orgKey1 = 'another-org-key';
            const productTypes1 = ['switch'];
            const apiDetails1 = getAPIDetails(orgKey1, productTypes1);
            assert.equal(apiDetails1.url, '/api/v1/networks');
            assert.equal(apiDetails1.method, 'GET');
            assert.equal(apiDetails1.requestBody, '');
            assert.equal(apiDetails1.orgKey, orgKey1);
            assert.deepEqual(apiDetails1.productTypes, productTypes1);

            const orgKey2 = 'yet-another-org-key';
            const productTypes2 = ['appliance'];
            const apiDetails2 = getAPIDetails(orgKey2, productTypes2);
            assert.equal(apiDetails2.url, '/api/v1/networks');
            assert.equal(apiDetails2.method, 'GET');
            assert.equal(apiDetails2.requestBody, '');
            assert.equal(apiDetails2.orgKey, orgKey2);
            assert.deepEqual(apiDetails2.productTypes, productTypes2);
        });
    });

    describe('fetchAllNetworks Pagination', function () {
        it('should paginate through all networks correctly', async function () {
            const url = '/api/v1/networks';
            const apiKey = 'your-api-key';
            const apiEndpoint = 'api.meraki.com';

            axiosGetStub.resolves({
                data: { networks: ['L_686235993220604684', 'L_686235993220604685'], hasNextPage: true },
                headers: { startingAfter: '2024-01-01T00:00:00' }
            });

            const networks = await fetchAllNetworks(url, apiKey, apiEndpoint);
            assert.equal(networks.networks.length, 2);
        });
    });




    describe('getAPIDetails Return Values', function () {
        it('should return correct API details', function () {
            const orgKey = 'your-org-key';
            const productTypes = ['appliance', 'switch'];

            const apiDetails = getAPIDetails(orgKey, productTypes);

            assert.strictEqual(apiDetails.url, '/api/v1/networks');
            assert.strictEqual(apiDetails.method, 'GET');
            assert.strictEqual(apiDetails.requestBody, '');
            assert.strictEqual(apiDetails.orgKey, orgKey);
            assert.deepStrictEqual(apiDetails.productTypes, productTypes);
        });
    });

    describe('fetchJsonFromS3Bucket', function () {
        it('should fetch JSON data from S3 bucket', async function () {
            const bucketName = 'test-bucket';
            const fileName = 'test.json';
            const mockResponseBody = JSON.stringify([{ id: 1, name: "Test" }]);

            const s3SendStub = sinon.stub(S3Client.prototype, 'send').resolves({
                Body: mockResponseBody
            });

            const result = await fetchJsonFromS3Bucket(bucketName, fileName);

            assert.equal(JSON.stringify(result), mockResponseBody);

            s3SendStub.restore();
        });
    });

    describe('getAPILogs - Max Pages Per Invocation Reached', function () {
        it('should stop accumulating logs after maxPagesPerInvocation and return accumulated data', async function () {
            const apiDetails = { productTypes: ['appliance', 'switch'] };
            const apiEndpoint = 'api.meraki.com';
            const state = { since: '2024-04-14T00:00:00Z', networkId: 'L_686235993220604684' };
            const clientSecret = 'your-secret';
            const maxPagesPerInvocation = 2;

            axiosGetStub.onFirstCall().returns(Promise.resolve({
                data: { events: [ciscomerakiMock.LOG_EVENT, ciscomerakiMock.LOG_EVENT], startingAfter: '2024-04-15T10:00:00Z' },
                headers: { link: '<https://api.meraki.com/next>; rel=next' }
            }));
            axiosGetStub.onSecondCall().returns(Promise.resolve({
                data: { events: [ciscomerakiMock.LOG_EVENT, ciscomerakiMock.LOG_EVENT], startingAfter: '2024-04-16T10:00:00Z' },
                headers: {}
            }));

            const result = await getAPILogs(apiDetails, [], apiEndpoint, state, clientSecret, maxPagesPerInvocation);

            assert.deepStrictEqual(result.accumulator.length, 4); // Total events from both pages
            assert.strictEqual(result.nextPage, undefined); // No more pages to fetch
        });
    });

    describe('Error Handling in fetchAllNetworks', function () {
        it('should handle non-rate-limit errors gracefully', async function () {
            axiosGetStub.rejects({ response: { status: 500 } });
            try {
                await fetchAllNetworks('/api/v1/networks', 'your-api-key', 'api.meraki.com');
            } catch (error) {
                assert.equal(error.response.status, 500);
            }
        });
    });

    describe('differenceOfNetworksArray', function () {
        it('should return the difference between two arrays of network IDs', function () {
            // Mock data
            const newNetworks = ['L_686235993220604684', 'L_686235993220604685', 'L_686235993220604686'];
            const oldNetworks = ['L_686235993220604684', 'L_686235993220604686'];

            const difference = differenceOfNetworksArray(newNetworks, oldNetworks);

            assert.deepStrictEqual(difference, ['L_686235993220604685']);
        });

        it('should return an empty array if oldNetworks contains all network IDs from newNetworks', function () {
            const newNetworks = ['L_686235993220604684', 'L_686235993220604685'];
            const oldNetworks = ['L_686235993220604684', 'L_686235993220604685', 'L_686235993220604686'];

            const difference = differenceOfNetworksArray(newNetworks, oldNetworks);

            assert.deepStrictEqual(difference, []);
        });

        it('should return newNetworks if oldNetworks is empty', function () {
            // Mock data
            const newNetworks = ['L_686235993220604684', 'L_686235993220604685'];

            const difference = differenceOfNetworksArray(newNetworks, []);

            assert.deepStrictEqual(difference, newNetworks);
        });

        it('should return an empty array if both newNetworks and oldNetworks are empty', function () {
            const difference = differenceOfNetworksArray([], []);

            assert.deepStrictEqual(difference, []);
        });
    });

    describe('Error Handling in getAPILogs', function () {
        it('should throw an error when networkId is not provided', async function () {
            const apiDetails = { productTypes: ['appliance', 'switch'] };
            const accumulator = [];
            const apiEndpoint = 'api.meraki.com';
            const state = { since: '2024-04-14T00:00:00Z' };
            const clientSecret = 'your-secret';
            const maxPagesPerInvocation = 2;

            axiosGetStub.returns(Promise.resolve({
                data: { events: [ciscomerakiMock.LOG_EVENT, ciscomerakiMock.LOG_EVENT], pageEndAt: '2024-04-15T10:00:00Z' },
                headers: { link: '<https://api.meraki.com/next>; rel=next' }
            }));

            try {
                await getAPILogs(apiDetails, accumulator, apiEndpoint, state, clientSecret, maxPagesPerInvocation);
                assert.fail('Expected an error to be thrown');
            } catch (error) {
                assert.equal(error.message, 'url is not defined');
            }
        });
    });

    describe('getOrgKeySecretEndPoint', function () {
        it('should return clientSecret, apiEndpoint, and orgKey when all parameters are provided', function () {
            process.env.paws_endpoint = 'https://meraki.com';
            process.env.paws_collector_param_string_2 = 'orgKey123';

            const result = getOrgKeySecretEndPoint('mockSecret');

            assert.equal(result.clientSecret, 'mockSecret');
            assert.equal(result.apiEndpoint, 'meraki.com');
            assert.equal(result.orgKey, 'orgKey123');
        });

        it('should call callback with error message if clientSecret is missing', function () {
            process.env.paws_endpoint = 'https://example.com';
            process.env.paws_collector_param_string_2 = 'orgKey123';
            const result = getOrgKeySecretEndPoint(null);
            assert.strictEqual(result, 'The Client Secret was not found!');
        });

        it('should call callback with error message if orgKey is missing', function () {
            process.env.paws_endpoint = 'https://example.com';
            process.env.paws_collector_param_string_2 = '';
            const result = getOrgKeySecretEndPoint('mockSecret');

            assert.strictEqual(result, 'orgKey was not found!');
        });
    });

    describe('getS3ObjectParams', function () {
        it('should return correct params', async function () {
            process.env.dl_s3_bucket_name = 'test-bucket';
            const keyValue = 'test-key';
            const data = { key: 'value' };

            const params = await getS3ObjectParams(keyValue, data);

            assert.deepStrictEqual(params, {
                data: data,
                key: keyValue,
                bucketName: 'test-bucket'
            });
        });

        it('should handle missing bucket name environment variable', async function () {
            delete process.env.dl_s3_bucket_name;
            const keyValue = 'test-key';
            const data = { key: 'value' };

            const params = await getS3ObjectParams(keyValue, data);

            assert.deepStrictEqual(params, {
                data: data,
                key: keyValue,
                bucketName: undefined
            });
        });
    });

    describe('uploadToS3Bucket', function() {
        let uploadS3ObjectStub;
        let loggerWarnStub;
    
        beforeEach(function() {
            uploadS3ObjectStub = sinon.stub(AlAwsUtil, 'uploadS3Object');
            loggerWarnStub = sinon.stub(AlLogger, 'warn');
        });
    
        afterEach(function() {
            uploadS3ObjectStub.restore();
            loggerWarnStub.restore();
        });
    
        it('should upload data to S3 bucket', function(done) {
            const uploadParams = { data: 'test-data', key: 'test-key', bucketName: 'test-bucket' };
    
            uploadS3ObjectStub.callsFake((params, callback) => callback(null));
    
            uploadToS3Bucket(uploadParams, (err) => {
                assert(uploadS3ObjectStub.calledOnce);
                assert.strictEqual(err, null);
                done();
            });
        });
    
        it('should handle upload errors gracefully', function(done) {
            const uploadParams = { data: 'test-data', key: 'test-key', bucketName: 'test-bucket' };
    
            uploadS3ObjectStub.callsFake((params, callback) => callback(new Error('Upload error')));
    
            uploadToS3Bucket(uploadParams, (err) => {
                assert(uploadS3ObjectStub.calledOnce);
                assert(loggerWarnStub.calledOnce);
                assert.strictEqual(err, null);
                done();
            });
        });
    
        it('should return error if bucket name is missing', function(done) {
            const uploadParams = { data: 'test-data', key: 'test-key', bucketName: '' };
    
            uploadToS3Bucket(uploadParams, (err) => {
                assert.strictEqual(err, 'CMRI0000011 error uploading to undefined bucket');
                done();
            });
        });
    
        it('should use default bucket name if not provided', function(done) {
            process.env.dl_s3_bucket_name = 'default-bucket';
            const uploadParams = { data: 'test-data', key: 'test-key', bucketName: '' };
    
            uploadS3ObjectStub.callsFake((params, callback) => callback(null));
    
            uploadToS3Bucket(uploadParams, (err) => {
                assert(uploadS3ObjectStub.calledOnce);
                assert.strictEqual(err, null);
                done();
            });
        });
    });

});
