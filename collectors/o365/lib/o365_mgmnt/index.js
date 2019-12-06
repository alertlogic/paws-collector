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

var g_appAdCreds = new ApplicationTokenCredentials(
    process.env.CUSTOMCONNSTR_APP_CLIENT_ID,
    process.env.AZURE_APP_TENANT_ID,
    process.env.CUSTOMCONNSTR_APP_CLIENT_SECRET,
    'https://manage.office.com'
);

var g_o365mgmnt = new m_o365mgmnt.O365Management(g_appAdCreds, process.env.AZURE_APP_TENANT_ID);

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
 * @returns {function} callback(err, result, request, response)
 *      {Error}  err        - The Error object if an error occurred, null otherwise.
 *      {null} [result]     - The deserialized result object if an error did not occur.
 *      {object} [request]  - The HTTP Request object if an error did not occur.
 *      {stream} [response] - The HTTP Response stream if an error did not occur.
 *
 */
var _subscriptionsContent = function(contentType, startTs, endTs) {
    return g_o365mgmnt.subscriptionsContent(contentType, startTs, endTs, null);
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
 * @returns {function} callback(err, result, request, response)
 *      {Error}  err        - The Error object if an error occurred, null otherwise.
 *      {null} [result]     - The deserialized result object if an error did not occur.
 *      {object} [request]  - The HTTP Request object if an error did not occur.
 *      {stream} [response] - The HTTP Response stream if an error did not occur.
 *
 */
var _getContent = function(contentUri) {
    return g_o365mgmnt.getContent(contentUri, null);
};


module.exports = {
    subscriptionsContent : _subscriptionsContent,
    getContent : _getContent
};
