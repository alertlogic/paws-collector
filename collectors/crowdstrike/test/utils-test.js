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
                assert(token == 'eyJhbGciOiJSUzI1NiIsImtpZCI6InB1YmxpYzphNDdiNTc2MS0zYzk3LTQwMmItOTgzNi0wNmNhODI0NTViOTMiLCJ0eXAiOiJKV1QifQ.eyJhdWQiOltdLCJjbGllbnRfaWQiOiJjMzZmMjE4Njg3OTE0NTRkOTJmZTBlYzlmNWJmMTI3YiIsImV4cCI6MTYyODg0MzE3MSwiZXh0Ijp7fSwiaWF0IjoxNjI4ODQxMzcxLCJpc3MiOiJodHRwczovL2FwaS5jcm93ZHN0cmlrZS5jb20vIiwianRpIjoiMmIwNGM2M2UtZjU2OC00OGZiLThhZTMtNDlmY2E5NDg0NTUzIiwibmJmIjoxNjI4ODQxMzcxLCJzY3AiOltdLCJzdWIiOiJjMzZmMjE4Njg3OTE0NTRkOTJmZTBlYzlmNWJmMTI3YiIsInN1Yl90eXBlIjpudWxsfQ.u-FOyIm50JDYgmq-DJ9XqMavBl9_51rVJOaqseaT42HOCMb6KOwiQ5HTS0YImzEQEEnqHOeamECFg1lMr8jfwKhuQcEM0AbWSqJ6pqPmu108WTEH-kwkhk9N5_ghJIWKI5tOJ5bNdgbYDV_CsFG1I9rjdGgzBO6AER7tvNoGs_kulUoQPGNRhYNmjXkVvnsOtaN9DGmfU8ONxfVJ1HOq_TYqae8J_VHLVt7UdZMQczRMP-qz2ryODjBTZr1latHwl4_85Ki0-4PlXzLOsOM8lqf1p_V5hivndM8q4g7URj7DV_8WaPGERUUPqKSpIQsPESyNLS9Bnym9QQJQR8FDFBOoi9C8qQ4SCOnt5YAwU6bLr3YzH2RKeGP7TXnmN1kqBSoobujVYRKWih7WrSYpzLQwDY6LYs8-uB_d13jdM_DA8rhkLwlHnPPWMVRJSK0438DQ03fRLToKJvDUUgZFfNLecqK3YevJ6vKhpa4pI3TUukMofL5b45NRix-z2b-rdhsEDsemSU1yvbXhclnuHuQKgPyELEF-_fc5iUz83StWZY8c0GIUUs6vET-MuNYBVIQC6qd_8jwecqLKTfp2zNX_HWmbby-9V5LLDCGbDP5MSs7ztXGYH3YsurvQX884smx50_oZFjtnf5nCP7V6XT2ohxZInn96NOoFth_yDrI', "token is wrong");
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


