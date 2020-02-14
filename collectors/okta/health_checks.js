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
 const PawsCollector = require('@alertlogic/paws-collector').PawsCollector;
 
    function oktaTokenHealthCheck(asyncCallback){
        /* No explicit call to validate an API token, the token expires after 30 days, this 30 day timeout is refreshed 
         * upon any API calls. This call will refresh token, without being time consuming/destructive
         */
        var orgUrl = process.env.paws_endpoint;
        var token = String.concat("SSWS", PawsCollector._pawsCreds.secret);
        var options = {
            host: orgUrl,
            path: "/api/v1/users/me",
            headers: {
                authorization: token
            }
        };
        https.get(options, (res) => {
          res.on('end', () => {
                asyncCallback(null);
          });
      
        }).on('error', (e) => {
          asyncCallback(e);
      });
    }
    
module.exports = {
    oktaTokenHealthCheck
};
