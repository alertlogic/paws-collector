const utils = require("../utils");
const assert = require('assert');
const sinon = require('sinon');
const RestServiceClient = require('@alertlogic/al-collector-js').RestServiceClient;
const sentineloneMock = require('./sentinelone_mock');

var alserviceStub = {};

describe('Unit Tests', function () {
    describe('Get API Logs', function () {
        it('Get API Logs success', function (done) {
            alserviceStub.get = sinon.stub(RestServiceClient.prototype, 'get').callsFake(
                function fakeFn() {
                    return new Promise(function (resolve, reject) {
                        return resolve({ data: [sentineloneMock.LOG_EVENT], pagination: { nextCursor: null } });
                    });
                });
            let maxPagesPerInvocation = 5;
            let accumulator = [];
            let token = "token";
            let params = {};
            const apiEndpoint = process.env.paws_endpoint;
            utils.getAPILogs(apiEndpoint, token, params, accumulator, maxPagesPerInvocation).then(data => {
                assert(accumulator.length == 1, "accumulator length is wrong");
                alserviceStub.get.restore();
                done();
            });
        });
    });

    describe('Get API Logs with nextPage', function () {
        it('Get API Logs with nextPage success', function (done) {
            alserviceStub.get = sinon.stub(RestServiceClient.prototype, 'get').callsFake(
                function fakeFn() {
                    return new Promise(function (resolve, reject) {
                        return resolve({ data: [sentineloneMock.LOG_EVENT], pagination: { nextCursor: "cursor" } });
                    });
                });
            let maxPagesPerInvocation = 5;
            let accumulator = [];
            let token = "token";
            let params = {};
            const apiEndpoint = process.env.paws_endpoint;
            utils.getAPILogs(apiEndpoint, token, params, accumulator, maxPagesPerInvocation).then(data => {
                assert(accumulator.length == 5, "accumulator length is wrong");
                alserviceStub.get.restore();
                done();
            });
        });
    });
});


