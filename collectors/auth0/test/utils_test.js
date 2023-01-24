const assert = require('assert');
const sinon = require('sinon');
const utils = require("../utils");
const moment = require('moment');
const auth0Mock = require('./auth0_mock');

let getLogsStub, auth0Client;

describe('Unit Tests', function () {

    beforeEach(function () {
        auth0Client = {
            getLogs: () => { }
        };
    });

    describe('Get API Logs', function () {
        it('Get API Logs', function (done) {
            getLogsStub = sinon.stub(auth0Client, 'getLogs').callsFake(
                function fakeFn() {
                    return new Promise(function (resolve, reject) {
                        return resolve([auth0Mock.AUTH0_LOG_EVENT]);
                    });
                });

            const startDate = moment().subtract(5, 'minutes');
            let state = {
                since: startDate.toISOString(),
                poll_interval_sec: 1
            };
            let maxPagesPerInvocation = 5;
            let accumulator = [];

            utils.getAPILogs(auth0Client, state, accumulator, maxPagesPerInvocation).then(data => {
                assert(accumulator.length == 5, "accumulator length is wrong");
                getLogsStub.restore();
                done();
            });
        });
    });

    describe('Get API Logs with error', function () {
        it('Get API Logs with error', function (done) {
            getLogsStub = sinon.stub(auth0Client, 'getLogs').callsFake(
                function fakeFn() {
                    return new Promise(function (resolve, reject) {
                        return reject(new Error("Test Error"));
                    });
                });
                
            const startDate = moment().subtract(5, 'minutes');    
            let state = {
                since: startDate.toISOString(),
                poll_interval_sec: 1
            };
            let maxPagesPerInvocation = 5;
            let accumulator = [];
    
            utils.getAPILogs(auth0Client, state, accumulator, maxPagesPerInvocation)
                .catch(err => {
                    assert.equal(err.message, "Test Error", "Error message is not correct");
                    getLogsStub.restore();
                    done();
                });
        });
    });
    

    describe('Get API Logs with last log id', function () {
        it('Get API Logs  with last log id', function (done) {
            getLogsStub = sinon.stub(auth0Client, 'getLogs').callsFake(
                function fakeFn() {
                    return new Promise(function (resolve, reject) {
                        return resolve([]);
                    });
                });
            let state = {
                last_log_id: "last_log_id",
                poll_interval_sec: 1
            };
            let maxPagesPerInvocation = 5;
            let accumulator = [];

            utils.getAPILogs(auth0Client, state, accumulator, maxPagesPerInvocation).then(data => {
                assert(accumulator.length == 0, "accumulator length is wrong");
                getLogsStub.restore();
                done();
            });
        });
    });
});