const utils = require("../utils");
const assert = require('assert');
const sinon = require('sinon');
const ciscoduoMock = require('./ciscoduo_mock');
const moment = require('moment');

let getLogsStub, client;

describe('Unit Tests', function () {

    beforeEach(function () {
        client = {
            jsonApiCall: () => { }
        };
    });

    describe('Get API Logs (Authentication)', function () {
        it('Get API Logs (Authentication) success', function (done) {
            getLogsStub = sinon.stub(client, 'jsonApiCall').yields({
                response: {
                    authlogs: [ciscoduoMock.LOG_EVENT],
                    metadata: {
                        next_offset: null
                    }
                },
                stat: 'OK'
            });
            let maxPagesPerInvocation = 5;
            let accumulator = [];
            const startDate = moment().subtract(5, 'days');
            let state = {
                stream: "Authentication",
                since: startDate.valueOf(),
                until: startDate.add(2, 'days').valueOf(),
                nextPage: null,
                poll_interval_sec: 1
            };
            let objectDetails = {
                url: "api_url",
                typeIdPaths: [{ path: ["txid"] }],
                tsPaths: [{ path: ["timestamp"] }],
                query: {
                    mintime: state.since,
                    maxtime: state.until,
                    limit: 1000
                },
                method: "GET"
            };
            utils.getAPILogs(client, objectDetails, state, accumulator, maxPagesPerInvocation).then(data => {
                assert(accumulator.length == 1, "accumulator length is wrong");
                getLogsStub.restore();
                done();
            });
        });
    });

    describe('Get API Logs (Authentication) with nextPage', function () {
        it('Get API Logs (Authentication) with nextPage success', function (done) {
            getLogsStub = sinon.stub(client, 'jsonApiCall').yields({
                response: {
                    authlogs: [ciscoduoMock.LOG_EVENT],
                    metadata: {
                        next_offset: ["1591261271641", "qqwwwwwwwwwww"]
                    }
                },
                stat: 'OK'
            });
            let maxPagesPerInvocation = 5;
            let accumulator = [];
            const startDate = moment().subtract(5, 'days');
            let state = {
                stream: "Authentication",
                since: startDate.valueOf(),
                until: startDate.add(2, 'days').valueOf(),
                nextPage: null,
                poll_interval_sec: 1
            };
            let objectDetails = {
                url: "api_url",
                typeIdPaths: [{ path: ["txid"] }],
                tsPaths: [{ path: ["timestamp"] }],
                query: {
                    mintime: state.since,
                    maxtime: state.until,
                    limit: 1000
                },
                method: "GET"
            };
            utils.getAPILogs(client, objectDetails, state, accumulator, maxPagesPerInvocation).then(data => {
                assert(accumulator.length == 5, "accumulator length is wrong");
                getLogsStub.restore();
                done();
            });
        });
    });

    describe('Get API Logs (Administrator)', function () {
        it('Get API Logs (Administrator) success', function (done) {
            getLogsStub = sinon.stub(client, 'jsonApiCall').yields({
                response: [],
                stat: 'OK'
            });
            let maxPagesPerInvocation = 5;
            let accumulator = [];
            const startDate = moment().subtract(5, 'days');
            let state = {
                stream: "Administrator",
                since: startDate.unix(),
                poll_interval_sec: 1
            };
            let objectDetails = {
                url: "api_url",
                typeIdPaths: [{ path: ["action"] }],
                tsPaths: [{ path: ["timestamp"] }],
                query: {
                    mintime: state.since
                },
                method: "GET"
            };
            utils.getAPILogs(client, objectDetails, state, accumulator, maxPagesPerInvocation).then(data => {
                assert(accumulator.length == 0, "accumulator length is wrong");
                getLogsStub.restore();
                done();
            });
        });
    });

    describe('Get API Logs (Administrator) with nextPage', function () {
        it('Get API Logs (Administrator) with nextPage success', function (done) {
            getLogsStub = sinon.stub(client, 'jsonApiCall').yields({
                response: [ciscoduoMock.LOG_EVENT],
                stat: 'OK'
            });
            let maxPagesPerInvocation = 5;
            let accumulator = [];
            const startDate = moment().subtract(5, 'days');
            let state = {
                stream: "Administrator",
                since: startDate.unix(),
                poll_interval_sec: 1
            };
            let objectDetails = {
                url: "api_url",
                typeIdPaths: [{ path: ["action"] }],
                tsPaths: [{ path: ["timestamp"] }],
                query: {
                    mintime: state.since
                },
                method: "GET"
            };
            utils.getAPILogs(client, objectDetails, state, accumulator, maxPagesPerInvocation).then(data => {
                assert(accumulator.length == 5, "accumulator length is wrong");
                getLogsStub.restore();
                done();
            });
        });
        it('Pull Only one page data if since stamp is less than one hour ', function (done) {
            ciscoduoMock.LOG_EVENT.timestamp = moment().subtract(30, 'minutes').unix();
            getLogsStub = sinon.stub(client, 'jsonApiCall').yields({
                response: [ciscoduoMock.LOG_EVENT],
                stat: 'OK'
            });
            let maxPagesPerInvocation = 5;
            let accumulator = [];
            const startDate = moment().subtract(30, 'minutes');
            let state = {
                stream: "Administrator",
                since: startDate.unix(),
                poll_interval_sec: 1
            };
            let objectDetails = {
                url: "api_url",
                typeIdPaths: [{ path: ["action"] }],
                tsPaths: [{ path: ["timestamp"] }],
                query: {
                    mintime: state.since
                },
                method: "GET"
            };
            utils.getAPILogs(client, objectDetails, state, accumulator, maxPagesPerInvocation).then(data => {
                assert(accumulator.length == 1);
                getLogsStub.restore();
                done();
            });
        });
    });

    describe('Get API Details', function () {
        it('Get API Details', function (done) {
            const startDate = moment().subtract(5, 'minutes');
            let objectDetailsArray = [];
            const objectNames = JSON.parse(process.env.collector_streams);
            objectNames.map(stream => {
                let state;
                if (stream === "Authentication") {
                    state = {
                        stream,
                        since: startDate.valueOf(),
                        until: startDate.add(5, 'minutes').valueOf(),
                        nextPage: "nextPage",
                        poll_interval_sec: 1
                    };
                }
                else {
                    state = {
                        stream,
                        since: startDate.unix(),
                        poll_interval_sec: 1
                    };
                }
                const APIDetails = utils.getAPIDetails(state);
                assert.notEqual(APIDetails.url, null);
                objectDetailsArray.push(APIDetails);
            });
            assert(objectDetailsArray.length == objectNames.length, "objectDetailsArray length is wrong");
            done();
        });
        it('Get API Details check url is null', function (done) {
            const startDate = moment().subtract(5, 'minutes');
            let state = {
                stream: "object",
                since: startDate.valueOf(),
                until: startDate.add(5, 'minutes').valueOf(),
                nextPage: null,
                poll_interval_sec: 1
            };
            const APIDetails = utils.getAPIDetails(state);
            assert.equal(APIDetails.url, null);
            done();
        });
    });

});
