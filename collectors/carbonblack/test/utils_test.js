const utils = require("../utils");
const assert = require('assert');
const sinon = require('sinon');
const moment = require('moment');
const RestServiceClient = require('@alertlogic/al-collector-js').RestServiceClient;
const carbonblackMock = require('./carbonblack_mock');

var alserviceStub = {};

describe('Unit Tests', function () {
    beforeEach(function () {
        alserviceStub.post = sinon.stub(RestServiceClient.prototype, 'post').callsFake(
            function fakeFn(path, extraOptions) {
                return new Promise(function (resolve, reject) {
                    return resolve({ results: [carbonblackMock.LOG_EVENT] });
                });
            });
        alserviceStub.get = sinon.stub(RestServiceClient.prototype, 'get').callsFake(
            function fakeFn(path, extraOptions) {
                return new Promise(function (resolve, reject) {
                    return resolve({ notifications: [carbonblackMock.LOG_EVENT] });
                });
            });
    });
    afterEach(function () {
        alserviceStub.post.restore();
        alserviceStub.get.restore();
    });

    describe('Get API Logs with GET Request', function () {
        it('Get API Logs with GET Request', function (done) {
            let maxPagesPerInvocation = 5;
            const startDate = moment().subtract(5, 'minutes');
            let state = {
                stream: "AuditLogEvents",
                since: startDate.toISOString(),
                until: startDate.add(5, 'minutes').toISOString(),
                poll_interval_sec: 1
            };
            let apiDetails = {
                url: "url",
                method: "GET",
                requestBody:"",
                typeIdPaths: [{ path: ["eventId"] }],
                tsPaths: [{ path: ["eventTime"] }]
            };
            let accumulator = [];
            const apiEndpoint = process.env.paws_endpoint;
            const clientSecret = process.env.paws_api_secret;
            const clientId = process.env.paws_api_client_id;

            utils.getAPILogs(apiDetails, accumulator, apiEndpoint, state, clientSecret, clientId, maxPagesPerInvocation).then(data => {
                assert(accumulator.length == 1, "accumulator length is wrong");
                done();
            });
        });
    });

    describe('Get API Logs  with POST Request', function () {
        it('Get API Logs  with POST Request', function (done) {
            let maxPagesPerInvocation = 5;
            const startDate = moment().subtract(5, 'minutes');
            let state = {
                stream: "SearchAlerts",
                since: startDate.toISOString(),
                until: startDate.add(5, 'minutes').toISOString(),
                poll_interval_sec: 1
            };
            let apiDetails = {
                url: "url",
                method: "POST",
                requestBody:{
                    "criteria": {
                        "create_time": {
                            "end": state.until,
                            "start": state.since
                        },
                    },
                    "rows": 0,
                    "start": 0
                },
                typeIdPaths: [{ path: ["id"] }],
                tsPaths: [{ path: ["last_update_time"] }]
            };
            let accumulator = [];
            const apiEndpoint = process.env.paws_endpoint;
            const clientSecret = process.env.paws_api_secret;
            const clientId = process.env.paws_api_client_id;

            utils.getAPILogs(apiDetails, accumulator, apiEndpoint, state, clientSecret, clientId, maxPagesPerInvocation).then(data => {
                assert(accumulator.length == 5, "accumulator length is wrong");
                done();
            });
        });
    });


    describe('Get API Details', function () {
        it('Get API Details', function (done) {
            const startDate = moment().subtract(5, 'minutes');
            const orgKey = "orgKey";
            let apiDetails = [];
            const apiNames = JSON.parse(process.env.collector_streams);
            apiNames.map(stream => {
                let state = {
                    stream: stream,
                    since: startDate.toISOString(),
                    until: startDate.add(5, 'minutes').toISOString(),
                    poll_interval_sec: 1
                };
                apiDetails.push(utils.getAPIDetails(state, orgKey));
            });
            assert(apiDetails.length == apiNames.length, "apiDetails length is wrong");
            done();
        });
    });
});
describe('Get API Logs (GET) with Error', function () {
    it('Get API Logs with Error (GET)', function (done) {
        alserviceStub.get = sinon.stub(RestServiceClient.prototype, 'get').callsFake(
            function fakeFn(path, extraOptions) {
                return new Promise(function (resolve, reject) {
                    return reject(new Error("Failed to fetch API logs due to an authentication issue"));
                });
            });
        let maxPagesPerInvocation = 5;
        const startDate = moment().subtract(5, 'minutes');
        let state = {
            stream: "AuditLogEvents",
            since: startDate.toISOString(),
            until: startDate.add(5, 'minutes').toISOString(),
            poll_interval_sec: 1
        };
        let apiDetails = {
            url: "url",
            method: "GET",
            requestBody:"",
            typeIdPaths: [{ path: ["eventId"] }],
            tsPaths: [{ path: ["eventTime"] }]
        };
        let accumulator = [];
        const apiEndpoint = process.env.paws_endpoint;
        const clientSecret = process.env.paws_api_secret;
        const clientId = process.env.paws_api_client_id;

        utils.getAPILogs(apiDetails, accumulator, apiEndpoint, state, clientSecret, clientId, maxPagesPerInvocation).catch(err => {
            assert.equal(err.message, "Failed to fetch API logs due to an authentication issue", "Error message is not correct");
            alserviceStub.get.restore();
            done();
        });
    });
});


describe('Get API Logs (POST Request) with Error', function () {
    it('Get API Logs with Error (POST)', function (done) {
        alserviceStub.post = sinon.stub(RestServiceClient.prototype, 'post').callsFake(
            function fakeFn(path, extraOptions) {
                return new Promise(function (resolve, reject) {
                    return reject(new Error("Failed to fetch API logs due to an authentication issue"));
                });
            });
        let maxPagesPerInvocation = 5;
        const startDate = moment().subtract(5, 'minutes');
        let state = {
            stream: "SearchAlerts",
            since: startDate.toISOString(),
            until: startDate.add(5, 'minutes').toISOString(),
            poll_interval_sec: 1
        };
        let apiDetails = {
            url: "url",
            method: "POST",
            requestBody:{
                "criteria": {
                    "create_time": {
                        "end": state.until,
                        "start": state.since
                    },
                },
                "rows": 0,
                "start": 0
            },
            typeIdPaths: [{ path: ["id"] }],
            tsPaths: [{ path: ["last_update_time"] }]
        };
        let accumulator = [];
        const apiEndpoint = process.env.paws_endpoint;
        const clientSecret = process.env.paws_api_secret;
        const clientId = process.env.paws_api_client_id;

        utils.getAPILogs(apiDetails, accumulator, apiEndpoint, state, clientSecret, clientId, maxPagesPerInvocation).catch(err => {
            assert.equal(err.message, "Failed to fetch API logs due to an authentication issue", "Error message is not correct");
            alserviceStub.post.restore();
            done();
        });
    });
});

describe('Get API Details when state.stream is null', function () {
    it('Get API Details when state.stream is null', function (done) {
        const startDate = moment().subtract(5, 'minutes');
        const orgKey = "orgKey";
        let apiDetails = [];
        const apiNames = JSON.parse(process.env.collector_streams_null);
        apiNames.map(stream => {
            let state = {
                stream: null,
                since: startDate.toISOString(),
                until: startDate.add(5, 'minutes').toISOString(),
                poll_interval_sec: 1
            };
            apiDetails.push(utils.getAPIDetails(state, orgKey));
        });
        assert(apiDetails.length == apiNames.length, "apiDetails length is wrong");
        done();
    });
});