const assert = require('assert');
const sinon = require('sinon');
const {O365Management} = require('../lib/o365_mgmnt/o365management');
const msRest = require('@azure/ms-rest-js');
const {ApplicationTokenCredentials} = require('@azure/ms-rest-nodeauth');
const msWebResource = msRest.WebResource;

function createManagmentInstance(){
    var g_appAdCreds = new ApplicationTokenCredentials(
        process.env.paws_api_client_id,
        process.env.paws_collector_param_string_1,
        'a secret',
        'https://manage.office.com'
    );

    return new O365Management(g_appAdCreds, process.env.paws_collector_param_string_1);
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
                headers: {
                    get(key){
                        return 'some-header-value';
                    }
                },
                parsedBody: [{foo: "bar"}],
                bodyAsText: '[{"foo": "bar"}]',
                status: 200
            };
            
            const handler = managmentInstance.requestHandler(httpRequest);
            const output = handler(mockRes);

            assert.deepEqual(output, {
                nextPageUri: 'some-header-value',
                parsedBody: mockRes.parsedBody
            });
            done();
        });

        it('handles a 200 result without a parsed body', (done) => {
            const mockRes = {
                headers: {
                    get(key){
                        return 'some-header-value';
                    }
                },
                bodyAsText: '[{"foo": "bar"}]',
                status: 200
            };
            
            const handler = managmentInstance.requestHandler(httpRequest);
            const output = handler(mockRes);

            assert.deepEqual(output, {
                nextPageUri: 'some-header-value',
                parsedBody: JSON.parse(mockRes.bodyAsText)
            });
            done();
        });

        it('throws on anything but a 200', (done) => {
            const mockRes = {
                headers: {
                    get(key){
                        return 'some-header-value';
                    }
                },
                bodyAsText: '[{"foo": "bar"}]',
                status: 400
            };
            
            const handler = managmentInstance.requestHandler(httpRequest);

            assert.throws(() => handler(mockRes));
            done();
        });
    });

    describe('startSubscription', () => {
        let sendRequestStub;

        it('formats the request object corectly', (done) => {
            sendRequestStub = sinon.stub(O365Management.prototype, 'sendRequest').callsFake(
                function fakeFn(request) {
                    return new Promise(function(resolve, reject) {
                        const mockRes = {
                            headers: {
                                get(key){
                                    return 'some-header-value';
                                }
                            },
                            parsedBody: [{foo: "bar"}],
                            bodyAsText: '[{"foo": "bar"}]',
                            status: 200
                        };

                        assert.equal(request.method, 'POST');
                        assert.notEqual(request.headers.headersArray(), 0);
                        return resolve(mockRes);
                    });
                });

            const managementInstance = createManagmentInstance();
            managementInstance.startSubscription('AFAkeStream', {}).then(() => {
                sendRequestStub.restore();
                done();
            });
        });

        it('sets custom headers correctly', (done) => {
            sendRequestStub = sinon.stub(O365Management.prototype, 'sendRequest').callsFake(
                function fakeFn(request) {
                    return new Promise(function(resolve, reject) {
                        const mockRes = {
                            headers: {
                                get(key){
                                    return 'some-header-value';
                                }
                            },
                            parsedBody: [{foo: "bar"}],
                            bodyAsText: '[{"foo": "bar"}]',
                            status: 200
                        };

                        assert.equal(request.headers.contains('foo'), true);
                        assert.equal(request.headers.get('foo'), 'bar');
                        return resolve(mockRes);
                    });
                });

            const managementInstance = createManagmentInstance();
            const options = {
                customHeaders:{
                    foo: "bar"
                }
            };
            managementInstance.startSubscription('AFAkeStream', options).then(() => {
                sendRequestStub.restore();
                done();
            });
        });
    });

    describe('listSubscriptions', () => {
        let sendRequestStub;

        it('formats the request object corectly', (done) => {
            sendRequestStub = sinon.stub(O365Management.prototype, 'sendRequest').callsFake(
                function fakeFn(request) {
                    return new Promise(function(resolve, reject) {
                        const mockRes = {
                            headers: {
                                get(key){
                                    return 'some-header-value';
                                }
                            },
                            parsedBody: [{foo: "bar"}],
                            bodyAsText: '[{"foo": "bar"}]',
                            status: 200
                        };

                        assert.equal(request.method, 'GET');
                        assert.notEqual(request.headers.headersArray(), 0);
                        return resolve(mockRes);
                    });
                });

            const managementInstance = createManagmentInstance();
            managementInstance.listSubscriptions({}).then(() => {
                sendRequestStub.restore();
                done();
            });
        });

        it('sets custom headers correctly', (done) => {
            sendRequestStub = sinon.stub(O365Management.prototype, 'sendRequest').callsFake(
                function fakeFn(request) {
                    return new Promise(function(resolve, reject) {
                        const mockRes = {
                            headers: {
                                get(key){
                                    return 'some-header-value';
                                }
                            },
                            parsedBody: [{foo: "bar"}],
                            bodyAsText: '[{"foo": "bar"}]',
                            status: 200
                        };

                        assert.equal(request.headers.contains('foo'), true);
                        assert.equal(request.headers.get('foo'), 'bar');
                        return resolve(mockRes);
                    });
                });

            const managementInstance = createManagmentInstance();
            const options = {
                customHeaders:{
                    foo: "bar"
                }
            };
            managementInstance.listSubscriptions(options).then(() => {
                sendRequestStub.restore();
                done();
            });
        });
    });

    describe('subscriptionsContent', () => {
        let sendRequestStub;

        it('formats the request object corectly', (done) => {
            sendRequestStub = sinon.stub(O365Management.prototype, 'sendRequest').callsFake(
                function fakeFn(request) {
                    return new Promise(function(resolve, reject) {
                        const mockRes = {
                            headers: {
                                get(key){
                                    return 'some-header-value';
                                }
                            },
                            parsedBody: [{foo: "bar"}],
                            bodyAsText: '[{"foo": "bar"}]',
                            status: 200
                        };

                        assert.equal(request.method, 'GET');
                        assert.notEqual(request.headers.headersArray(), 0);
                        return resolve(mockRes);
                    });
                });

            const managementInstance = createManagmentInstance();
            managementInstance.subscriptionsContent('AFakeStream', 'startDate', 'endDate', {}).then(() => {
                sendRequestStub.restore();
                done();
            });
        });

        it('sets custom headers correctly', (done) => {
            sendRequestStub = sinon.stub(O365Management.prototype, 'sendRequest').callsFake(
                function fakeFn(request) {
                    return new Promise(function(resolve, reject) {
                        const mockRes = {
                            headers: {
                                get(key){
                                    return 'some-header-value';
                                }
                            },
                            parsedBody: [{foo: "bar"}],
                            bodyAsText: '[{"foo": "bar"}]',
                            status: 200
                        };

                        assert.equal(request.headers.contains('foo'), true);
                        assert.equal(request.headers.get('foo'), 'bar');
                        return resolve(mockRes);
                    });
                });

            const managementInstance = createManagmentInstance();
            const options = {
                customHeaders:{
                    foo: "bar"
                }
            };
            managementInstance.subscriptionsContent('AFakeStream', 'startDate', 'endDate', options).then(() => {
                sendRequestStub.restore();
                done();
            });
        });
    });

    describe('getPreFormedUrl', () => {
        let sendRequestStub;

        it('formats the request object corectly', (done) => {
            sendRequestStub = sinon.stub(O365Management.prototype, 'sendRequest').callsFake(
                function fakeFn(request) {
                    return new Promise(function(resolve, reject) {
                        const mockRes = {
                            headers: {
                                get(key){
                                    return 'some-header-value';
                                }
                            },
                            parsedBody: [{foo: "bar"}],
                            bodyAsText: '[{"foo": "bar"}]',
                            status: 200
                        };

                        assert.equal(request.method, 'GET');
                        assert.notEqual(request.headers.headersArray(), 0);
                        return resolve(mockRes);
                    });
                });

            const managementInstance = createManagmentInstance();
            managementInstance.getPreFormedUrl('https://www.joeiscool.com', {}).then(() => {
                sendRequestStub.restore();
                done();
            });
        });

        it('sets custom headers correctly', (done) => {
            sendRequestStub = sinon.stub(O365Management.prototype, 'sendRequest').callsFake(
                function fakeFn(request) {
                    return new Promise(function(resolve, reject) {
                        const mockRes = {
                            headers: {
                                get(key){
                                    return 'some-header-value';
                                }
                            },
                            parsedBody: [{foo: "bar"}],
                            bodyAsText: '[{"foo": "bar"}]',
                            status: 200
                        };

                        assert.equal(request.headers.contains('foo'), true);
                        assert.equal(request.headers.get('foo'), 'bar');
                        return resolve(mockRes);
                    });
                });

            const managementInstance = createManagmentInstance();
            const options = {
                customHeaders:{
                    foo: "bar"
                }
            };
            managementInstance.getPreFormedUrl('https://www.joeiscool.com', options).then(() => {
                sendRequestStub.restore();
                done();
            });
        });
    });

});
