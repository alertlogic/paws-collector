const assert = require('assert');
const sinon = require('sinon');
const utils = require("../utils");
const salesforceMock = require('./salesforce_mock');
var jsforce = require('jsforce');
const moment = require('moment');

let mockConnectionObject, mockActivityObject, conn;
describe('Unit Tests', function () {
    beforeEach(function () {
        conn = sinon.createStubInstance(jsforce.Connection);
        conn.query = () => { };
        mockConnectionObject = sinon.stub(jsforce, 'Connection').callsFake(
            function fakeFn(path) {
                return conn;
            });
    });
    afterEach(function () {
        mockConnectionObject.restore();
        mockActivityObject.restore();
    });

    describe('Get Object Logs', function () {
        it('Get Object Logs', function (done) {
            mockActivityObject = sinon.stub(conn, 'query').callsFake(
                function fakeFn(err, result) {
                    return result(null, { records: [salesforceMock.LOG_EVENT] });
                });
            let maxPagesPerInvocation = 5;
            let response = {
                body: `{}`
            };
            let objectQueryDetails = {
                query: "query",
                tsPaths: [{ path: ["LastLoginDate"] }],
                sortFieldName: "Id",
                sortType: "ASC"
            };
            const startDate = moment().subtract(5, 'minutes');
            let state = {
                object: "LoginHistory",
                since: startDate.toISOString(),
                until: startDate.add(5, 'minutes').toISOString(),
                poll_interval_sec: 1
            };
            let accumulator = [];
            utils.getObjectLogs(response, objectQueryDetails, accumulator, state, maxPagesPerInvocation).then(data => {
                assert(accumulator.length == 5, "accumulator length is wrong");
                done();
            });
        });
    });

    describe('Get Object Logs with no records', function () {
        it('Get Object Logs with no records', function (done) {
            mockActivityObject = sinon.stub(conn, 'query').callsFake(
                function fakeFn(err, result) {
                    return result(null, { records: [] });
                });
            let maxPagesPerInvocation = 5;
            let response = {
                body: `{}`
            };
            let objectQueryDetails = {
                query: "query",
                tsPaths: [{ path: ["EventDate"] }],
                sortFieldName: "EventDate",
                sortType: "DESC"
            };
            const startDate = moment().subtract(5, 'minutes');
            let state = {
                object: "ApiEvent",
                since: startDate.toISOString(),
                until: startDate.add(5, 'minutes').toISOString(),
                poll_interval_sec: 1
            };
            let accumulator = [];
            utils.getObjectLogs(response, objectQueryDetails, accumulator, state, maxPagesPerInvocation).then(data => {
                assert(accumulator.length == 0, "accumulator length is wrong");
                done();
            });
        });
    });

    describe('Get Object Query', function () {
        it('Get Object Query', function (done) {
            const startDate = moment().subtract(5, 'minutes');
            let objectQueryDetails = [];
            const objectNames = JSON.parse(process.env.collector_streams);
            objectNames.map(object => {
                let state = {
                    object: object,
                    since: startDate.toISOString(),
                    until: startDate.add(5, 'minutes').toISOString(),
                    poll_interval_sec: 1
                };
                objectQueryDetails.push(utils.getObjectQuery(state));
            });
            assert(objectQueryDetails.length == objectNames.length, "objectQueryDetails length is wrong");
            done();
        });
    });
});