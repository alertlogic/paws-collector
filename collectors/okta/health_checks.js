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

 const https = require('https');
 
    function oktaTokenHealthCheck(asyncCallback){
        /* No explicit call to validate an API token, the token expires after 30 days, this 30 day timeout is refreshed 
         * upon any API calls. This call will refresh token, without being time consuming/destructive
         */
        var orgUrl = process.env.paws_endpoint;
        var token = "SSWS " + this._pawsCreds.secret;
        var options = {
            host: orgUrl.replace("https://", ""),
            path: "/api/v1/users/me",
            headers: {
                Accept: "application/json",
                Content: "application/json",
                Authorization: token
            }
        };
        https.get(options, (res) => {
          res.on('end', () => {
                asyncCallback(null);
          });
      
        }).on('error', (e) => {
            var err = e.message;
            asyncCallback(`OKTA000003 Failed to validate auth token for ${orgUrl} due to error ${err}`);
      });
    }
    
module.exports = {
    oktaTokenHealthCheck
};
