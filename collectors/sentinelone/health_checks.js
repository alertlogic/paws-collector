/* -----------------------------------------------------------------------------
 * @copyright (C) 2020, Alert Logic, Inc
 * @doc
 *
 * sentinelone health checks.
 *
 * @end
 * -----------------------------------------------------------------------------
 */

'use strict';

const health = require('@alertlogic/al-aws-collector-js').Health;
const RestServiceClient = require('@alertlogic/al-collector-js').RestServiceClient;
const moment = require('moment');

/* 
* No explicit call to validate an API token, the token expires after 180 days, this 180 day timeout is refreshed 
* upon any API calls. This call will refresh token, without being time consuming/destructive
*/
function sentinelOneTokenHealthCheck(callback) {
    const hostname = process.env.paws_endpoint.replace(/^https:\/\/|\/$/g, '');
    const token = this.secret;

    let restServiceClient = new RestServiceClient(hostname);
    restServiceClient.post('/web/api/v2.0/users/api-token-details', {
        json: {
            "data": {
                "apiToken": token
            }
        }
    }).then((response) => {
        const expiresAt = moment(response.data.expiresAt).subtract(1, 'days').toISOString();
        if (moment().isBefore(expiresAt)) {
            return callback();
        }
        else {
            restServiceClient.post("/web/api/v2.0/users/generate-api-token", {
                headers: {
                    "Authorization": `ApiToken ${token}`
                }
            }).then(response => {
                this.setPawsSecret(response.data.token).then((response) => {
                    return callback();
                });
            }).catch(error => {
                const err = health.errorMsg('SONE000003', `Failed to generate auth token for ${hostname} due to error ${error.message}`);
                return callback(err);
            });
        }
    }).catch((error) => {
        const err = health.errorMsg('SONE000004', `Failed to validate auth token for ${hostname} due to error ${error.message}`);
        return callback(err);
    });
}

module.exports = {
    sentinelOneTokenHealthCheck
};
