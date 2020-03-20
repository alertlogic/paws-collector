/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * Okta health checks.
 *
 * @end
 * -----------------------------------------------------------------------------
 */

'use strict';

const health = require('@alertlogic/al-aws-collector-js').Health;
const RestServiceClient = require('@alertlogic/al-collector-js').RestServiceClient;
 
/* 
* No explicit call to validate an API token, the token expires after 30 days, this 30 day timeout is refreshed 
* upon any API calls. This call will refresh token, without being time consuming/destructive
*/
function oktaTokenHealthCheck(callback){
    const hostname = process.env.paws_endpoint.replace(/^https:\/\/|\/$/g, '');
    const token = 'SSWS ' + this.secret;
    const options = {
        headers: {
            Accept: 'application/json',
            Content: 'application/json',
            Authorization: token
        }
    };
    let cli = new RestServiceClient(hostname);
    cli.get('/api/v1/users/me', options)
    .then((resp) => {
        return callback();
    })
    .catch((e) => {
        const err = health.errorMsg('OKTA000003', `Failed to validate auth token for ${hostname} due to error ${e.message}`);
        return callback(err);
    });
}

module.exports = {
    oktaTokenHealthCheck
};
