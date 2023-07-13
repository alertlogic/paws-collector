const assert = require('assert');
const sinon = require('sinon');
const utils = require("../utils");
const gsuiteMock = require('./gsuite_mock');
const { google } = require("googleapis");
const service = google.admin('reports_v1');
const alertsService = google.alertcenter('v1beta1');
let mockServiceObject, mockActivityObject;
let mockAlertsServiceObject;
let mockAlertsObject;
describe('Unit Tests', function () {
    beforeEach(function () {
        service.activities = gsuiteMock.MOCK_ACTIVITES;
        mockServiceObject = sinon.stub(google, 'admin').callsFake(
            function fakeFn(path) {
                return service;
            });
    });

    afterEach(function () {
        mockServiceObject.restore();
        mockActivityObject.restore();
    });

    describe('List Event From Gsuite', function () {
        it('Check List Event Logs', function (done) {

            mockActivityObject = sinon.stub(service.activities, 'list').callsFake(
                function fakeFn(params) {
                    return new Promise(function (resolve, reject) {
                        let response = {
                            data: {
                                items: [gsuiteMock.LOG_EVENT]
                            }
                        };
                        if (params.token) {
                            delete params.token;
                            response.data.nextPageToken = "dummy-token";

                        } else {
                            delete response.data.nextPageToken;

                        }
                        return resolve(response);
                    });
                });
            let auth = null;
            let params = {
                token: true
            };
            let maxPagesPerInvocation = 5;
            let accumulator = [];
            utils.listEvents(auth, params, accumulator, maxPagesPerInvocation).then(data => {
                assert(accumulator.length == 2, "accumulator length is wrong");
                done();
            });
        });

        it('Check List Event with Max Pages Per Invocation condition', function (done) {

            mockActivityObject = sinon.stub(service.activities, 'list').callsFake(
                function fakeFn(params) {
                    return new Promise(function (resolve, reject) {
                        let response = {
                            data: {
                                items: [gsuiteMock.LOG_EVENT]
                            }
                        };

                        response.data.nextPageToken = "dummy-token";
                        return resolve(response);
                    });
                });
            let auth = null;
            let params = {};
            let maxPagesPerInvocation = 5;
            let accumulator = [];
            utils.listEvents(auth, params, accumulator, maxPagesPerInvocation).then(data => {
                assert(accumulator.length == 5, "accumulator length is wrong");
                done();
            });
        });
    });

    describe('List Event From Gsuite Error Case', function () {
        it('Check List Event Logs Error Case', function (done) {
            let auth = null;
            let params = {};
            let accumulator = [];
            let maxPagesPerInvocation = 5;
            utils.listEvents(auth, params, accumulator, maxPagesPerInvocation).catch(err => {
                assert.ok(err);
                done();
            });
        });
    });
});


describe('Alerts Unit Tests', function () {
    beforeEach(function () {
        alertsService.alerts = gsuiteMock.MOCK_ALERTS;
        mockAlertsServiceObject = sinon.stub(google, 'alertcenter').callsFake(
            function fakeFn(path) {
                return alertsService;
            });
    });

    afterEach(function () {
        mockAlertsServiceObject.restore();
        mockAlertsObject.restore();
    });

    describe('List Alerts From Gsuite', function () {
        it('Check List Alerts Logs', function (done) {
            mockAlertsObject = sinon.stub(alertsService.alerts, 'list').callsFake(
                function fakeFn(params) {
                    return new Promise(function (resolve, reject) {
                        let response = {
                            data: {
                                alerts: [gsuiteMock.LOG_ALERT]
                            }
                        };
                        if (params.token) {
                            delete params.token;
                            response.data.nextPageToken = "dummy-token";

                        } else {
                            delete response.data.nextPageToken;

                        }
                        return resolve(response);
                    });
                });
            let auth = null;
            let params = {
                token: true
            };
            let maxPagesPerInvocation = 5;
            let accumulator = [];
            utils.listAlerts(auth, params, accumulator, maxPagesPerInvocation).then(data => {
                assert(accumulator.length == 2, "accumulator length is wrong");
                done();
            });
        });

        it('Check List Alerts with Max Pages Per Invocation condition', function (done) {

            mockAlertsObject = sinon.stub(alertsService.alerts, 'list').callsFake(
                function fakeFn(params) {
                    return new Promise(function (resolve, reject) {
                        let response = {
                            data: {
                                alerts: [gsuiteMock.LOG_ALERT]
                            }
                        };

                        response.data.nextPageToken = "dummy-token";
                        return resolve(response);
                    });
                });
            let auth = null;
            let params = {};
            let maxPagesPerInvocation = 5;
            let accumulator = [];
            utils.listAlerts(auth, params, accumulator, maxPagesPerInvocation).then(data => {
                assert(accumulator.length == 5, "accumulator length is wrong");
                done();
            });
        });
    });

    describe('List Alerts From Gsuite Error Case', function () {
        it('Check List Alerts Logs Error Case', function (done) {
            let auth = null;
            let params = {};
            let accumulator = [];
            let maxPagesPerInvocation = 5;
            utils.listAlerts(auth, params, accumulator, maxPagesPerInvocation).catch(err => {
                assert.ok(err);
                done();
            });
        });
    });
});