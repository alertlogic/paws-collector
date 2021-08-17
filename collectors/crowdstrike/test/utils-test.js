const utils = require("../utils");
const assert = require('assert');
const sinon = require('sinon');
const moment = require('moment');
const RestServiceClient = require('@alertlogic/al-collector-js').RestServiceClient;
const crowdstrikeMock = require('./Crowdstrike-mock');

var alserviceStub = {};

function exeStub() {
    alserviceStub.post = sinon.stub(RestServiceClient.prototype, 'post').callsFake(
        function fakeFn(path, extraOptions) {
            return new Promise(function (resolve, reject) {
                return resolve(crowdstrikeMock.LIST);
            });
        });
    alserviceStub.get = sinon.stub(RestServiceClient.prototype, 'get').callsFake(
        function fakeFn(path, extraOptions) {
            return new Promise(function (resolve, reject) {
                return resolve(crowdstrikeMock.LIST);
            });
        });
}

describe('Unit Tests', function () {

    afterEach(function () {
        alserviceStub.post.restore();
        alserviceStub.get.restore();
    });

    describe('Get List with GET Request', function () {
        it('Get List with GET Request', function (done) {
            exeStub();
            let apiDetails = {
                url: "url",
                method: "GET",
                requestBody:"",
                typeIdPaths: [{ path: ["incident_type"] }],
                tsPaths: [{ path: ["created"] }]
            };
            let accumulator = [];
            const apiEndpoint = process.env.paws_endpoint;
            const token = crowdstrikeMock.AUTHENTICATE.access_token;

            utils.getList(apiDetails, accumulator, apiEndpoint, token).then(data => {
                assert(data.accumulator.length == 2, "accumulator length is wrong");
                done();
            });
        });
    });

    describe('POST Detections Request', function () {
        it('POST Detection Request', function (done) {
            exeStub();
            let apiDetails = {
                url: "url",
                method: "GET",
                requestBody:"",
                typeIdPaths: [{ path: ["detection_id"] }],
                tsPaths: [{ path: ["created_timestamp"] }]
            };
            const token = crowdstrikeMock.AUTHENTICATE.access_token;

            utils.getDetections(crowdstrikeMock.LIST.resources, apiDetails, token).then(data => {
                assert(data.resources.length == 2, "accumulator length is wrong");
                done();
            });
        });
    });

    describe('POST Detections Request with empty IDs array', function () {
        it('POST Detection Request', function (done) {
            exeStub();
            let apiDetails = {
                url: "url",
                method: "GET",
                requestBody:"",
                typeIdPaths: [{ path: ["detection_id"] }],
                tsPaths: [{ path: ["created_timestamp"] }]
            };
            const token = crowdstrikeMock.AUTHENTICATE.access_token;

            utils.getDetections([], apiDetails, token).then(data => {
                assert(data.resources.length == 0, "accumulator length is wrong");
                done();
            });
        });
    });

    describe('POST Incident Request', function () {
        it('POST Incident Request', function (done) {
            exeStub();
            let apiDetails = {
                url: "url",
                method: "GET",
                requestBody:"",
                typeIdPaths: [{ path: ["incident_type"] }],
                tsPaths: [{ path: ["created"] }]
            };
            const token = crowdstrikeMock.AUTHENTICATE.access_token;

            utils.getIncidents(crowdstrikeMock.LIST.resources, apiDetails, token).then(data => {
                assert(data.resources.length == 2, "accumulator length is wrong");
                done();
            });
        });
    });

    describe('POST Incident Request with empty IDs array', function () {
        it('POST Incident Request', function (done) {
            exeStub();
            let apiDetails = {
                url: "url",
                method: "GET",
                requestBody:"",
                typeIdPaths: [{ path: ["incident_type"] }],
                tsPaths: [{ path: ["created"] }]
            };
            const token = crowdstrikeMock.AUTHENTICATE.access_token;

            utils.getIncidents([], apiDetails, token).then(data => {
                assert(data.resources.length == 0, "accumulator length is wrong");
                done();
            });
        });
    });

    describe('Authentication Request', function () {
        beforeEach(function() {
            alserviceStub.post = sinon.stub(RestServiceClient.prototype, 'post').callsFake(
                function fakeFn(path, extraOptions) {
                    return new Promise(function (resolve, reject) {
                        return resolve(crowdstrikeMock.AUTHENTICATE);
                    });
                }
            );
        });
        it('Authentication Request', function (done) {
            const apiEndpoint = process.env.paws_endpoint;
            const clientSecret = process.env.paws_api_secret;
            const clientId = process.env.paws_api_client_id;

            utils.authenticate(apiEndpoint, clientId, clientSecret).then(token => {
                assert(token == 'test_token', "token is wrong");
                done();
            });
        });
    });

    describe('Get API Details', function () {
        it('Get API Details', function (done) {
            exeStub();
            const startDate = moment().subtract(5, 'minutes');
            let apiDetails = [];
            const apiNames = JSON.parse(process.env.collector_streams);
            apiNames.map(stream => {
                let state = {
                    stream: stream,
                    since: startDate.toISOString(),
                    until: startDate.add(5, 'minutes').toISOString(),
                    poll_interval_sec: 1
                };
                apiDetails.push(utils.getAPIDetails(state));
            });
            assert(apiDetails.length == apiNames.length, "apiDetails length is wrong");
            done();
        });
    });
});


