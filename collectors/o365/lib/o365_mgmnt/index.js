/* -----------------------------------------------------------------------------
 * @copyright (C) 2017, Alert Logic, Inc
 * @doc
 * 
 * The module for communicating with O365 management APIs.
 * 
 * @end
 * -----------------------------------------------------------------------------
 */

const m_o365mgmnt = require('./o365management');

const {ApplicationTokenCredentials} = require('@azure/ms-rest-nodeauth');

function getO365ManagmentClient(creds) {

    if (creds.secret && creds.client_id) {
        const AzureTenantId = process.env.paws_collector_param_string_1;
        var g_appAdCreds = new ApplicationTokenCredentials(
            creds.client_id,
            AzureTenantId,
            creds.secret,
            'https://manage.office.com'
        );
        return new m_o365mgmnt.O365Management(g_appAdCreds, AzureTenantId);
    } else throw new Error("client secret or client id must be a non empty string.");
}

module.exports = {
    getO365ManagmentClient: getO365ManagmentClient
};
