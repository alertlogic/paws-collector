const utils = require("../utils");
const assert = require('assert');
const sinon = require('sinon');
const RestServiceClient = require('@alertlogic/al-collector-js').RestServiceClient;
const ciscoampMock = require('./ciscoamp_mock');
const moment = require('moment');

var alserviceStub = {};

describe('Unit Tests', function () {
    describe('Get API Logs', function () {
        it('Get API Logs success with few records and no next page', function (done) {
            alserviceStub.get = sinon.stub(RestServiceClient.prototype, 'get').callsFake(
                function fakeFn() {
                    return new Promise(function (resolve, reject) {
                        return resolve({body: { data: [ciscoampMock.LOG_EVENT], metadata: { links: { self: "selfPageUrl" }, results: { total: 100 } } } });
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
                assert.equal(data.nextPage, undefined);
                // Check if there is no nextpage it will set the newSince value from received data for Events stream only
                assert.equal(moment(data.newSince).toISOString(), moment(ciscoampMock.LOG_EVENT.date).toISOString());
                alserviceStub.get.restore();
                done();
            });
        });
        it('Get API Logs return 0 records then nextPage and newSince value is undefined', function (done) {
            alserviceStub.get = sinon.stub(RestServiceClient.prototype, 'get').callsFake(
                function fakeFn() {
                    return new Promise(function (resolve, reject) {
                        return resolve({body: { data: [], metadata: { links: { self: "selfPageUrl" }, results: { total: 0 } } } });
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
                assert(accumulator.length == 0, "accumulator length is wrong");
                assert.equal(data.nextPage, undefined);
                assert.equal(data.newSince, null);
                alserviceStub.get.restore();
                done();
            });
        });
    });

    describe('Get API Logs with nextPage', function () {
        it('Page count is more than maxPagesPerInvocation then return tha nextPage url for next invocation', function (done) {
            alserviceStub.get = sinon.stub(RestServiceClient.prototype, 'get').callsFake(
                function fakeFn() {
                    return new Promise(function (resolve, reject) {
                        return resolve({ body: { data: [ciscoampMock.LOG_EVENT], metadata: { links: { next: "nextPageUrl" }, results: { total: 100 } } } });
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
                assert.equal(data.nextPage, 'nextPageUrl');
                assert.notEqual(data.newSince, null);
                alserviceStub.get.restore();
                done();
            });
        });

        it('Pages are less than the maxPagesPerInvocation then return data with newSince value for next invocation', function (done) {
            let count = 0;
            alserviceStub.get = sinon.stub(RestServiceClient.prototype, 'get').callsFake(
                function fakeFn() {
                    if (count < 3) {
                        count++;
                        return new Promise(function (resolve, reject) {
                            return resolve({ body: { data: [ciscoampMock.LOG_EVENT], metadata: { links: { self: "selfPageUrl", next: "nextPageUrl" }, results: { total: 100 } } } });
                        });
                    } else {
                        return new Promise(function (resolve, reject) {
                            return resolve({ body: { data: [ciscoampMock.LOG_EVENT], metadata: { links: { self: "selfPageUrl" }, results: { total: 100 } } } });
                        });
                    }

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
                assert(accumulator.length == 4, "accumulator length is wrong");
                assert.equal(moment(data.newSince).toISOString(), moment(ciscoampMock.LOG_EVENT.date).toISOString());
                assert.equal(data.nextPage, null);
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
