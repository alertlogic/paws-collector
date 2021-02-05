const utils = require("../utils");
const assert = require('assert');
const sinon = require('sinon');
const RestServiceClient = require('@alertlogic/al-collector-js').RestServiceClient;
const ciscoampMock = require('./ciscoamp_mock');
const moment = require('moment');

var alserviceStub = {};

describe('Unit Tests', function () {
    describe('Get API Logs', function () {
        it('Get API Logs success', function (done) {
            alserviceStub.get = sinon.stub(RestServiceClient.prototype, 'get').callsFake(
                function fakeFn() {
                    return new Promise(function (resolve, reject) {
                        return resolve({ headers: { 'x-ratelimit-remaining': 2000, 'x-ratelimit-reset': 3000 }, body: { data: [ciscoampMock.LOG_EVENT], metadata: { links: {}, results: { total: 100 } } } });
                    });
                });
            let maxPagesPerInvocation = 5;
            let accumulator = [];
            let authorization = "authorization";
            let apiUrl = "apiUrl";
            const startDate = moment().subtract(5, 'days');
            let state = {
                stream: "Events",
                since: startDate.toISOString(),
                until: startDate.add(5, 'days').toISOString(),
                totalLogsCount: 0,
                poll_interval_sec: 1
            };
            const baseUrl = process.env.paws_endpoint;
            utils.getAPILogs(baseUrl, authorization, apiUrl, state, accumulator, maxPagesPerInvocation).then(data => {
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
                        return resolve({ headers: { 'x-ratelimit-remaining': 199, 'x-ratelimit-reset': 3000 }, body: { data: [ciscoampMock.LOG_EVENT], metadata: { links: { next: "nextPageUrl" }, results: { total: 100 } } } });
                    });
                });
            let maxPagesPerInvocation = 5;
            let accumulator = [];
            let authorization = "authorization";
            let apiUrl = "apiUrl";
            const startDate = moment().subtract(5, 'days');
            let state = {
                stream: "Events",
                since: startDate.toISOString(),
                until: startDate.add(5, 'days').toISOString(),
                totalLogsCount: 0,
                poll_interval_sec: 1
            };
            const baseUrl = process.env.paws_endpoint;
            utils.getAPILogs(baseUrl, authorization, apiUrl, state, accumulator, maxPagesPerInvocation).then(data => {
                assert(accumulator.length == 5, "accumulator length is wrong");
                alserviceStub.get.restore();
                done();
            });
        });
    });

    describe('Get API Logs with discard condition', function () {
        it('Get API Logs with discard condition', function (done) {
            alserviceStub.get = sinon.stub(RestServiceClient.prototype, 'get').callsFake(
                function fakeFn() {
                    return new Promise(function (resolve, reject) {
                        return resolve({ headers: { 'x-ratelimit-remaining': 199, 'x-ratelimit-reset': 3000 }, body: { data: [ciscoampMock.LOG_EVENT], metadata: { links: { next: "nextPageUrl" }, results: { total: 100 } } } });
                    });
                });
            let maxPagesPerInvocation = 5;
            let accumulator = [];
            let authorization = "authorization";
            let apiUrl = "apiUrl";
            const startDate = moment().subtract(5, 'days');
            let state = {
                stream: "Events",
                since: startDate.toISOString(),
                until: startDate.add(5, 'days').toISOString(),
                totalLogsCount: 50,
                poll_interval_sec: 1
            };
            const baseUrl = process.env.paws_endpoint;
            utils.getAPILogs(baseUrl, authorization, apiUrl, state, accumulator, maxPagesPerInvocation).then(data => {
                assert(accumulator.length == 0, "accumulator length is wrong");
                alserviceStub.get.restore();
                done();
            });
        });
    });

    describe('Get API Details', function () {
        it('Get API Details', function (done) {
            const startDate = moment().subtract(5, 'minutes');
            let resourceDetailsArray = [];
            const resourceNames = JSON.parse(process.env.collector_streams);
            resourceNames.map(stream => {
                let state = {
                    stream: stream,
                    since: startDate.toISOString(),
                    until: startDate.add(5, 'minutes').toISOString(),
                    totalLogsCount: 0,
                    poll_interval_sec: 1
                };
                const APIDetails = utils.getAPIDetails(state);
                assert.notEqual(APIDetails.url, null);
                resourceDetailsArray.push(APIDetails);
            });
            assert(resourceDetailsArray.length == resourceNames.length, "resourceDetailsArray length is wrong");
            done();
        });
        it('Get API Details check url is null', function (done) {
            const startDate = moment().subtract(5, 'minutes');
            let state = {
                stream: "resource",
                since: startDate.toISOString(),
                until: startDate.add(5, 'minutes').toISOString(),
                totalLogsCount: 0,
                poll_interval_sec: 1
            };
            const APIDetails = utils.getAPIDetails(state);
            assert.equal(APIDetails.url, null);
            done();
        });
    });

});
