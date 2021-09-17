const m_al_aws = require('@alertlogic/al-aws-collector-js');
const sinon = require('sinon');
const assert = require('assert');
const PawsHealthCheck = require('../paws_health_checks');

describe('Paws Health Checks', function () {
    it('Check custom health check return the error if custom metrics show errors ', function (done) {
        let spyCustomMetrics = sinon.stub(m_al_aws.Stats, 'getCustomMetrics').callsFake(
            function fakeFn(functionName, metricName, namespace, customDimesions, callback) {
                return callback(null, { 'Label': 'PawsClientError', 'Datapoints': [{ 'Timestamp': '2017-11-21T16:40:00Z', 'Sum': 1, 'Unit': 'Count' }] });
            });
        process.env.paws_type_name = 'okta';
        process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function-name';
        PawsHealthCheck.customHealthCheck((err, res) => {
            assert.equal(err.status, 'error');
            assert.equal(err.code, 'PAWS000403');
            assert.equal(err.details, 'Please check stream status errors and collector configuration');
            sinon.assert.calledOnce(spyCustomMetrics);
            spyCustomMetrics.restore();
            done();
        });
    });
    it('Check custom health check return the null if custom metrics did not show any errors ', function (done) {
        let spyCustomMetrics = sinon.stub(m_al_aws.Stats, 'getCustomMetrics').callsFake(
            function fakeFn(functionName, metricName, namespace, customDimesions, callback) {
                return callback(null, { 'Label': 'PawsClientError', 'Datapoints': [] });
            });
        process.env.paws_type_name = 'okta';
        process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function-name';
        PawsHealthCheck.customHealthCheck((err, res) => {
            assert.equal(err, null);
            sinon.assert.calledOnce(spyCustomMetrics);
            spyCustomMetrics.restore();
            done();
        });
    });
});