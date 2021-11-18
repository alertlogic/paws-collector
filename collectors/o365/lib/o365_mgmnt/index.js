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

const m_o365mgmnt = require('./o365management');

const {ApplicationTokenCredentials} = require('@azure/ms-rest-nodeauth');

function getO365ManagmentClient(pawsCreds) {
    return new Promise((resolve, reject) => {
        const AzureTenantId = process.env.paws_collector_param_string_1;
        var g_appAdCreds = new ApplicationTokenCredentials(
            pawsCreds.client_id,
            AzureTenantId,
            pawsCreds.secret,
            'https://manage.office.com'
        );
        if (pawsCreds.client_id && pawsCreds.secret && AzureTenantId) {
            resolve(new m_o365mgmnt.O365Management(g_appAdCreds, AzureTenantId));
        }
        else reject("Paws credential or AzureTenantId should not be empty")
    });
}

/**
 * @summary Office 365 Management API subscription/list.
 *
 * Office 365 Management API subscription/content.
 * {@link https://docs.microsoft.com/en-us/office/office-365-management-api/office-365-management-activity-api-reference#list-current-subscriptions Reference.}
 * 
 * @returns {Promise}
 *
 */
var _listSubscriptions = function(pawsCreds) {
    return getO365ManagmentClient(pawsCreds).then((client) => {
        return client.listSubscriptions(null)
    });
};

/**
 * @summary Office 365 Management API subscription/.
 *
 * Office 365 Management API subscription/content.
 * {@link https://docs.microsoft.com/en-us/office/office-365-management-api/office-365-management-activity-api-reference#start-a-subscription Reference.}
 * 
 * @param {string} contentType - Offices 365 management API activity content types: 
 * Audit.AzureActiveDirectory, Audit.Exchange, Audit.SharePoint, Audit.General, DLP.All
 *
 * @returns {Promise}
 *
 */
var _startSubscription = function(contentType, pawsCreds) {
    return getO365ManagmentClient(pawsCreds).then((client) => {
        return client.startSubscription(contentType, null)
    });
};

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
 *
 * @returns {Promise}
 *
 */
var _subscriptionsContent = function(contentType, startTs, endTs, pawsCreds) {
    return getO365ManagmentClient(pawsCreds).then((client) => {
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
 *
 * @returns {Promise}
 *
 */
var _getPreFormedUrl = function(contentUri, pawsCreds) {
    return getO365ManagmentClient(pawsCreds).then((client) => {
        return client.getPreFormedUrl(contentUri, null);
    });
};


module.exports = {
    listSubscriptions: _listSubscriptions,
    startSubscription: _startSubscription,
    subscriptionsContent : _subscriptionsContent,
    getPreFormedUrl : _getPreFormedUrl
};
