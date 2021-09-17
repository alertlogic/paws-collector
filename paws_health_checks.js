/** -----------------------------------------------------------------------------
 * @copyright (C) 2021, Alert Logic, Inc
 * @doc
 *
 * Health checks functions for PAWS collector
 *
 * @end
 * -----------------------------------------------------------------------------
 */

'use strict';
const AlAwsStatsTmpls = require('@alertlogic/al-aws-collector-js').Stats;
const al_health = require('@alertlogic/al-aws-collector-js').Health

/**
    * To fetch the custom metrics data and return the error if PawsClientError metrics show errors. 
    * @param {*} asyncCallback 
    * @returns 
    */
function customHealthCheck(asyncCallback) {
    const customDimentions =
    {
        Name: 'CollectorType',
        Value: process.env.paws_type_name
    }

    AlAwsStatsTmpls.getCustomMetrics(
        process.env.AWS_LAMBDA_FUNCTION_NAME, 'PawsClientError', 'PawsCollectors', customDimentions, (err, res) => {
            const datapointSum = res && res.Datapoints.length > 0 && res.Datapoints[0].Sum ? res.Datapoints[0].Sum : 0;
            if (datapointSum > 0) {
                return asyncCallback(al_health.errorMsg('PAWS000403','Please check stream status errors and collector configuration'));
            }
            return asyncCallback(null);
        }
    );
}

module.exports = {
    customHealthCheck: customHealthCheck
}