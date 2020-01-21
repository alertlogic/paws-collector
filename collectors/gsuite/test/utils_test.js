const assert = require('assert');
const sinon = require('sinon');
const utils = require("../utils");
const gsuiteMock = require('./gsuite_mock');
const { google, admin_reports_v1 } = require("googleapis");

let mockServiceObject, mockActivityObject, service;
describe('Unit Tests', function () {

    beforeEach(function () { 
        service = sinon.createStubInstance(admin_reports_v1.Admin);
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
            let accumulator = [];
            utils.listEvents(auth, params, accumulator).then(data => {     
                assert(accumulator.length == 2, "accumulator length is wrong");
                done();
            });
        });
    });
    

    describe('List Event From Gsuite Error Case', function () {
        it('Check List Event Logs Error Case', function (done) {
            let auth = null;
            let params = {};
            let accumulator = [];
            utils.listEvents(auth, params, accumulator).catch(err=>{
                assert.ok(err);
                done();
            });
        });
    });
});