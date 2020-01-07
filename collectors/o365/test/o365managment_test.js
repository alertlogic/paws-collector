const assert = require('assert');
const sinon = require('sinon');
const {O365Management} = require('../lib/o365_mgmnt/o365management');
var m_alCollector = require('@alertlogic/al-collector-js');
const msRest = require('@azure/ms-rest-js');
const {AzureServiceClient}= require('@azure/ms-rest-azure-js');
const {ApplicationTokenCredentials} = require('@azure/ms-rest-nodeauth');
const msWebResource = msRest.WebResource;

var alserviceStub = {};
var responseStub = {};
var setEnvStub = {};
var subscriptionsContentStub;
var getContentStub;

function createManagmentInstance(){
    var g_appAdCreds = new ApplicationTokenCredentials(
        process.env.CUSTOMCONNSTR_APP_CLIENT_ID,
        process.env.AZURE_APP_TENANT_ID,
        'a secret',
        'https://manage.office.com'
    );

    return new O365Management(g_appAdCreds, process.env.AZURE_APP_TENANT_ID)
}

describe('O365 managment tests', function() {

    describe('request handler tests', function(){
        let managmentInstance;
        let httpRequest;
        beforeEach(() => {
            managmentInstance = createManagmentInstance();
            httpRequest = new msWebResource();
        });

        it('handles a 200 result', (done) => {
            const mockRes = {
                parsedBody: [{foo: "bar"}],
                bodyAsText: '[{"foo": "bar"}]',
                status: 200
            };
            
            const handler = managmentInstance.requestHandler(httpRequest);
            const output = handler(mockRes);

            assert.deepEqual(output, mockRes.parsedBody);
            done();
        });

        it('handles a 200 result without a parsed body', (done) => {
            const mockRes = {
                bodyAsText: '[{"foo": "bar"}]',
                status: 200
            };
            
            const handler = managmentInstance.requestHandler(httpRequest);
            const output = handler(mockRes);

            assert.deepEqual(output, [{foo: "bar"}]);
            done();
        });

        it('throws on anything but a 200', (done) => {
            const mockRes = {
                bodyAsText: '[{"foo": "bar"}]',
                status: 400
            };
            
            const handler = managmentInstance.requestHandler(httpRequest);

            assert.throws(() => handler(mockRes));
            done();
        });
    });

    describe('subscriptionsContent', () => {
        let sendRequestStub;

        it('formats the request object corectly', (done) => {
            sendRequestStub = sinon.stub(O365Management.prototype, 'sendRequest').callsFake(
                function fakeFn(request) {
                    return new Promise(function(resolve, reject) {
                        const mockRes = {
                            parsedBody: [{foo: "bar"}],
                            bodyAsText: '[{"foo": "bar"}]',
                            status: 200
                        };

                        assert.equal(request.method, 'GET')
                        assert.notEqual(request.headers.headersArray(), 0)
                        return resolve(mockRes);
                    });
                });

            const managementInstance = createManagmentInstance();
            managementInstance.subscriptionsContent('AFakeStream', 'startDate', 'endDate', {}).then(() => {
                sendRequestStub.restore()
                done();
            })
        })

        it('sets custom headers correctly', (done) => {
            sendRequestStub = sinon.stub(O365Management.prototype, 'sendRequest').callsFake(
                function fakeFn(request) {
                    return new Promise(function(resolve, reject) {
                        const mockRes = {
                            parsedBody: [{foo: "bar"}],
                            bodyAsText: '[{"foo": "bar"}]',
                            status: 200
                        };

                        assert.equal(request.headers.contains('foo'), true)
                        assert.equal(request.headers.get('foo'), 'bar')
                        return resolve(mockRes);
                    });
                });

            const managementInstance = createManagmentInstance();
            const options = {
                customHeaders:{
                    foo: "bar"
                }
            }
            managementInstance.subscriptionsContent('AFakeStream', 'startDate', 'endDate', options).then(() => {
                sendRequestStub.restore();
                done();
            })
        })
    })

    describe('getContent', () => {
        let sendRequestStub;

        it('formats the request object corectly', (done) => {
            sendRequestStub = sinon.stub(O365Management.prototype, 'sendRequest').callsFake(
                function fakeFn(request) {
                    return new Promise(function(resolve, reject) {
                        const mockRes = {
                            parsedBody: [{foo: "bar"}],
                            bodyAsText: '[{"foo": "bar"}]',
                            status: 200
                        };

                        assert.equal(request.method, 'GET')
                        assert.notEqual(request.headers.headersArray(), 0)
                        return resolve(mockRes);
                    });
                });

            const managementInstance = createManagmentInstance();
            managementInstance.getContent('https://www.joeiscool.com', {}).then(() => {
                sendRequestStub.restore()
                done();
            })
        })

        it('sets custom headers correctly', (done) => {
            sendRequestStub = sinon.stub(O365Management.prototype, 'sendRequest').callsFake(
                function fakeFn(request) {
                    return new Promise(function(resolve, reject) {
                        const mockRes = {
                            parsedBody: [{foo: "bar"}],
                            bodyAsText: '[{"foo": "bar"}]',
                            status: 200
                        };

                        assert.equal(request.headers.contains('foo'), true)
                        assert.equal(request.headers.get('foo'), 'bar')
                        return resolve(mockRes);
                    });
                });

            const managementInstance = createManagmentInstance();
            const options = {
                customHeaders:{
                    foo: "bar"
                }
            }
            managementInstance.getContent('https://www.joeiscool.com', options).then(() => {
                sendRequestStub.restore();
                done();
            })
        })
    })

});
