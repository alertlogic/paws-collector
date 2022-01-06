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
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;
const SalesforceCollector = require('./collector').SalesforceCollector;

exports.handler = SalesforceCollector.makeHandler(function(event, context) {
    debug('input event: ', event);
    AlLogger.defaultMeta = { requestId: context.awsRequestId };
    SalesforceCollector.load().then(function(creds) {
        var salesforcec = new SalesforceCollector(context, creds);
        salesforcec.handleEvent(event);
    });
});
