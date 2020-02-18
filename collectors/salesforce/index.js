/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * Salesforce System logs extension.
 *
 * @end
 * -----------------------------------------------------------------------------
 */

const debug = require('debug') ('index');

const SalesforceCollector = require('./collector').SalesforceCollector;

exports.handler = function(event, context) {
    debug('input event: ', event);
    SalesforceCollector.load().then(function(creds) {
        var salesforcec = new SalesforceCollector(context, creds);
        salesforcec.handleEvent(event);
    });
};
