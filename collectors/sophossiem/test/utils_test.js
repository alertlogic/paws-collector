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
            const apiEndpoint = process.env.paws_endpoint;
            utils.getAPILogs(apiEndpoint, headers, state, accumulator, maxPagesPerInvocation).then(data => {
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
            const apiEndpoint = process.env.paws_endpoint;
            utils.getAPILogs(apiEndpoint, headers, state, accumulator, maxPagesPerInvocation).then(data => {
                assert(accumulator.length == 5, "accumulator length is wrong");
                alserviceStub.get.restore();
                done();
            });
        });
    });
});


