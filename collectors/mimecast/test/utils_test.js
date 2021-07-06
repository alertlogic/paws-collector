const utils = require("../utils");
const assert = require('assert');
const sinon = require('sinon');
const mimecastMock = require('./mimecast_mock');
var request = require('request');
const moment = require('moment');

var alserviceStub = {};

describe('Unit Tests', function () {
    describe('Get API Logs (AttachmentProtectLogs)', function () {
        it('Get API Logs (AttachmentProtectLogs) success', function (done) {
            alserviceStub.post = sinon.stub(request, 'post').yields(null,{},JSON.stringify({ fail: [], data: [{ attachmentLogs: [mimecastMock.LOG_EVENT] }], meta: { pagination: {} } }));
            let maxPagesPerInvocation = 5;
            let accumulator = [];
            const startDate = moment().subtract(5, 'days');
            let state = {
                stream: "AttachmentProtectLogs",
                since: startDate.utc().format(),
                until: startDate.add(2, 'days').utc().format(),
                nextPage: null,
                poll_interval_sec: 1
            };
            let authDetails = {
                "baseUrl": "baseUrl",
                "accessKey": "accessKey",
                "secretKey": "secretKey",
                "appId": "appId",
                "appKey": "appKey"
            };
            utils.getAPILogs(authDetails, state, accumulator, maxPagesPerInvocation).then(data => {
                assert(accumulator.length == 1, "accumulator length is wrong");
                alserviceStub.post.restore();
                done();
            });
        });
    });

    describe('Get API Logs (AttachmentProtectLogs) with nextpage', function () {
        it('Get API Logs (AttachmentProtectLogs) with nextpage success', function (done) {
            alserviceStub.post = sinon.stub(request, 'post').yields(null,{},JSON.stringify({ fail: [], data: [{ attachmentLogs: [mimecastMock.LOG_EVENT] }], meta: { pagination: { next: "next" } } }));
            let maxPagesPerInvocation = 5;
            let accumulator = [];
            const startDate = moment().subtract(5, 'days');
            let state = {
                stream: "AttachmentProtectLogs",
                since: startDate.utc().format(),
                until: startDate.add(2, 'days').utc().format(),
                nextPage: null,
                poll_interval_sec: 1
            };
            let authDetails = {
                "baseUrl": "baseUrl",
                "accessKey": "accessKey",
                "secretKey": "secretKey",
                "appId": "appId",
                "appKey": "appKey"
            };
            utils.getAPILogs(authDetails, state, accumulator, maxPagesPerInvocation).then(data => {
                assert(accumulator.length == 5, "accumulator length is wrong");
                alserviceStub.post.restore();
                done();
            });
        });
    });

    describe('Get API Logs (URLProtectLogs)', function () {
        it('Get API Logs (URLProtectLogs) success', function (done) {
            alserviceStub.post = sinon.stub(request, 'post').yields(null,{},JSON.stringify({ fail: [], data: [{ clickLogs: [mimecastMock.URL_PROTECT_LOGS_EVENT] }], meta: { pagination: {} } }));
            let maxPagesPerInvocation = 5;
            let accumulator = [];
            const startDate = moment().subtract(5, 'days');
            let state = {
                stream: "URLProtectLogs",
                since: startDate.utc().format(),
                until: startDate.add(2, 'days').utc().format(),
                nextPage: null,
                poll_interval_sec: 1
            };
            let authDetails = {
                "baseUrl": "baseUrl",
                "accessKey": "accessKey",
                "secretKey": "secretKey",
                "appId": "appId",
                "appKey": "appKey"
            };
            utils.getAPILogs(authDetails, state, accumulator, maxPagesPerInvocation).then(data => {
                assert(accumulator.length == 1, "accumulator length is wrong");
                alserviceStub.post.restore();
                done();
            });
        });
    });

    describe('Get API Logs (URLProtectLogs) with nextpage', function () {
        it('Get API Logs (URLProtectLogs) with nextpage success', function (done) {
            alserviceStub.post = sinon.stub(request, 'post').yields(null,{},JSON.stringify({ fail: [], data: [{ clickLogs: [mimecastMock.URL_PROTECT_LOGS_EVENT] }], meta: { pagination: { next: "next" } } }));
            let maxPagesPerInvocation = 5;
            let accumulator = [];
            const startDate = moment().subtract(5, 'days');
            let state = {
                stream: "URLProtectLogs",
                since: startDate.utc().format(),
                until: startDate.add(2, 'days').utc().format(),
                nextPage: null,
                poll_interval_sec: 1
            };
            let authDetails = {
                "baseUrl": "baseUrl",
                "accessKey": "accessKey",
                "secretKey": "secretKey",
                "appId": "appId",
                "appKey": "appKey"
            };
            utils.getAPILogs(authDetails, state, accumulator, maxPagesPerInvocation).then(data => {
                assert(accumulator.length == 5, "accumulator length is wrong");
                alserviceStub.post.restore();
                done();
            });
        });
    });

    describe('Get API Logs (MalwareFeed) with no logs', function () {
        it('Get API Logs (MalwareFeed) with no logs success', function (done) {
            alserviceStub.post = sinon.stub(request, 'post').yields(null, { "headers": {} },JSON.stringify({ id: "bundle--bf8be578-3953-4b80-ae84-312d149b91e8", objects: [] } ));
            let maxPagesPerInvocation = 5;
            let accumulator = [];
            let state = {
                stream: "MalwareFeed",
                nextPage: null,
                poll_interval_sec: 1
            };
            let authDetails = {
                "baseUrl": "baseUrl",
                "accessKey": "accessKey",
                "secretKey": "secretKey",
                "appId": "appId",
                "appKey": "appKey"
            };
            utils.getAPILogs(authDetails, state, accumulator, maxPagesPerInvocation).then(data => {
                assert(accumulator.length == 0, "accumulator length is wrong");
                alserviceStub.post.restore();
                done();
            });
        });
    });

    describe('Get API Logs (MalwareFeed)', function () {
        it('Get API Logs (MalwareFeed) success', function (done) {
            alserviceStub.post = sinon.stub(request, 'post').yields(null, { "headers": { "x-mc-threat-feed-next-token": "token" } },JSON.stringify({ id: "bundle--bf8be578-3953-4b80-ae84-312d149b91e8", objects: [mimecastMock.MALWARE_FEED_LOGS_EVENT] } ));
            let maxPagesPerInvocation = 5;
            let accumulator = [];
            let state = {
                stream: "MalwareFeed",
                nextPage: null,
                poll_interval_sec: 1
            };
            let authDetails = {
                "baseUrl": "baseUrl",
                "accessKey": "accessKey",
                "secretKey": "secretKey",
                "appId": "appId",
                "appKey": "appKey"
            };
            utils.getAPILogs(authDetails, state, accumulator, maxPagesPerInvocation).then(data => {
                assert(accumulator.length == 5, "accumulator length is wrong");
                alserviceStub.post.restore();
                done();
            });
        });
    });

    describe('Get API Logs (SiemLogs)', function () {
        it('Get API Logs (SiemLogs) success with last token', function (done) {
            alserviceStub.post = sinon.stub(request, 'post').yields(null, {
                "meta": {
                    "isLastToken": true
                }},JSON.stringify({ "data": [] }));
            let maxPagesPerInvocation = 5;
            let accumulator = [];
            let state = {
                stream: "SiemLogs",
                nextPage: null,
                poll_interval_sec: 1
            };
            let authDetails = {
                "baseUrl": "baseUrl",
                "accessKey": "accessKey",
                "secretKey": "secretKey",
                "appId": "appId",
                "appKey": "appKey"
            };
            utils.getAPILogs(authDetails, state, accumulator, maxPagesPerInvocation).then(data => {
                assert(accumulator.length == 0, "accumulator length is wrong");
                alserviceStub.post.restore();
                done();
            });
        });
    });

    describe('Get API Logs (SiemLogs)', function () {
        it('Get API Logs (SiemLogs) with nextpage success', function (done) {
            alserviceStub.post = sinon.stub(request, 'post').yields(null, { "headers": { "mc-siem-token": "token" } },JSON.stringify(mimecastMock.SIEM_LOGS_EVENT));
            let maxPagesPerInvocation = 5;
            let accumulator = [];
            let state = {
                stream: "SiemLogs",
                nextPage: null,
                poll_interval_sec: 1
            };
            let authDetails = {
                "baseUrl": "baseUrl",
                "accessKey": "accessKey",
                "secretKey": "secretKey",
                "appId": "appId",
                "appKey": "appKey"
            };
            utils.getAPILogs(authDetails, state, accumulator, maxPagesPerInvocation).then(data => {
                assert(accumulator.length == 5, "accumulator length is wrong");
                alserviceStub.post.restore();
                done();
            });
        });
    });

    describe('Get API Logs (MalwareFeed)', function () {
        it('Get API Logs (MalwareFeed) with Api Throttling success', function (done) {
            alserviceStub.post = sinon.stub(request, 'post').yields(null,{ "statusCode": 429 },"The Mimecast service you're trying to access is temporarily busy. Please try again in a few minutes and then contact your IT helpdesk if you still have problems.");
            let maxPagesPerInvocation = 5;
            let accumulator = [];
            let state = {
                stream: "MalwareFeed",
                nextPage: null,
                poll_interval_sec: 1
            };
            let authDetails = {
                "baseUrl": "baseUrl",
                "accessKey": "accessKey",
                "secretKey": "secretKey",
                "appId": "appId",
                "appKey": "appKey"
            };
            utils.getAPILogs(authDetails, state, accumulator, maxPagesPerInvocation).catch((error) => {
                assert.equal(error.statusCode, 429);
                alserviceStub.post.restore();
                done();
            });
        });
    });
});
