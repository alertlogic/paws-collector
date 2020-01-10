/* -----------------------------------------------------------------------------
 * @copyright (C) 2017, Alert Logic, Inc
 * @doc
 * 
 * The module for communicating with O365 management APIs.
 * 
 * @end
 * -----------------------------------------------------------------------------
 */

const util = require('util');
const PawsCollector = require('@alertlogic/paws-collector').PawsCollector;

const m_o365mgmnt = require('./o365management');

const {ApplicationTokenCredentials} = require('@azure/ms-rest-nodeauth');

function getO365ManagmentClient(){
    return PawsCollector.load().then(({pawsCreds}) => {
        var g_appAdCreds = new ApplicationTokenCredentials(
            process.env.CUSTOMCONNSTR_APP_CLIENT_ID,
            process.env.AZURE_APP_TENANT_ID,
            pawsCreds.secret,
            'https://manage.office.com'
        );

        return new m_o365mgmnt.O365Management(g_appAdCreds, process.env.AZURE_APP_TENANT_ID)
    })
}

/**
 * @summary Office 365 Management API subscription/content.
 *
 * Office 365 Management API subscription/content.
 * {@link https://msdn.microsoft.com/office-365/office-365-management-activity-api-reference#list-available-content Reference.}
 * 
 * @param {string} contentType - Offices 365 management API activity content types: 
 * Audit.AzureActiveDirectory, Audit.Exchange, Audit.SharePoint, Audit.General, DLP.All
 * @param {timestamp} startTs - Optional datetimes (UTC) indicating the time range of content to return.
 * @param {timestamp} endTs - Optional datetimes (UTC) indicating the time range of content to return.
 * @param {function} callback - The callback.
 *
 * @returns {Promise}
 *
 */
var _subscriptionsContent = function(contentType, startTs, endTs) {
    return getO365ManagmentClient().then((client) => {
        return client.subscriptionsContent(contentType, startTs, endTs, null)
    });
};

/**
 * @summary Office 365 Management API fetch content.
 *
 * Office 365 Management API fetch content.
 * {@link https://msdn.microsoft.com/office-365/office-365-management-activity-api-reference#retrieving-content Reference.}
 *
 * @param {string} contentUri - content URI specified in notification or subscriptions/content API call results.
 * @param {function} callback - The callback.
 *
 * @returns {Promise}
 *
 */
var _getPreFormedUrl = function(contentUri) {
    return getO365ManagmentClient().then((client) => {
        return client.getPreFormedUrl(contentUri, null);
    });
};


module.exports = {
    subscriptionsContent : _subscriptionsContent,
    getPreFormedUrl : _getPreFormedUrl
};
