const utils = require("../utils");
const assert = require('assert');
const sinon = require('sinon');
const RestServiceClient = require('@alertlogic/al-collector-js').RestServiceClient;
const sentineloneMock = require('./sophossiem_mock');
const moment = require('moment');

var alserviceStub = {};

describe('Unit Tests', function () {
    describe('Get API Logs with has more false', function () {
        it('Get API Logs with has more false success', function (done) {
            alserviceStub.get = sinon.stub(RestServiceClient.prototype, 'get').callsFake(
                function fakeFn() {
                    return new Promise(function (resolve, reject) {
                        return resolve({ items: [sentineloneMock.LOG_EVENT], next_cursor: "next_cursor", has_more: false });
                    });
                });
            let maxPagesPerInvocation = 5;
            let accumulator = [];
            let headers = {};
            const startDate = moment().subtract(23, 'hours');
            const state = {
                stream: "Events",
                from_date: startDate.unix(),
                poll_interval_sec: 1
            };
            const baseUrl = "api-us03.central.sophos.com";
            utils.getAPILogs(baseUrl, headers, state, accumulator, maxPagesPerInvocation).then(data => {
                assert(accumulator.length == 1, "accumulator length is wrong");
                alserviceStub.get.restore();
                done();
            });
        });
    });

    describe('Get API Logs with has more ture', function () {
        it('Get API Logs with has more ture success', function (done) {
            alserviceStub.get = sinon.stub(RestServiceClient.prototype, 'get').callsFake(
                function fakeFn() {
                    return new Promise(function (resolve, reject) {
                        return resolve({ items: [sentineloneMock.LOG_EVENT], next_cursor: "next_cursor", has_more: true });
                    });
                });
            let maxPagesPerInvocation = 5;
            let accumulator = [];
            let headers = {};
            const state = {
                stream: "Alerts",
                nextPage: "next_cursor",
                poll_interval_sec: 1
            };
            const baseUrl = "api-us03.central.sophos.com";
            utils.getAPILogs(baseUrl, headers, state, accumulator, maxPagesPerInvocation).then(data => {
                assert(accumulator.length == 5, "accumulator length is wrong");
                alserviceStub.get.restore();
                done();
            });
        });
    });
    describe('Authenticate', function () {
        it('Authenticate success', function (done) {
            alserviceStub.post = sinon.stub(RestServiceClient.prototype, 'post').callsFake(
                function fakeFn() {
                    return new Promise(function (resolve, reject) {
                        return resolve({ "access_token": "access_token" });
                    });
                });
            let client_secret = "client_secret";
            let client_id = "client_id";
            const baseUrl = "id.sophos.com";
            utils.authenticate(baseUrl, client_id, client_secret).then(token => {
                assert.equal(token, "access_token");
                alserviceStub.post.restore();
                done();
            });
        });
    });

    describe('getTenantIdAndDataRegion', function () {
        it('Get Tenant Id And DataRegion success', function (done) {
            alserviceStub.get = sinon.stub(RestServiceClient.prototype, 'get').callsFake(
                function fakeFn() {
                    return new Promise(function (resolve, reject) {
                        return resolve({
                            "id": "57ca9a6b-885f-4e36-95ec-290548c26059",
                            "idType": "tenant",
                            "apiHosts": {
                                "global": "https://api.central.sophos.com",
                                "dataRegion": "https://api-us03.central.sophos.com"
                            }
                        });
                    });
                });
            let token = "token";
            const baseUrl = "api.central.sophos.com";
            utils.getTenantIdAndDataRegion(baseUrl, token).then(response => {
                assert.equal(response.id, "57ca9a6b-885f-4e36-95ec-290548c26059");
                assert.equal(response.apiHosts.dataRegion, "https://api-us03.central.sophos.com");
                alserviceStub.get.restore();
                done();
            });
        });
    });
});


