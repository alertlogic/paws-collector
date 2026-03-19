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

exports.handler = SalesforceCollector.makeHandler(async function(event, context) {
    debug('input event: ', event);
    AlLogger.defaultMeta = { requestId: context.awsRequestId };
    try {
        const creds = await SalesforceCollector.load();
        let salesforcec = new SalesforceCollector(context, creds);
        await salesforcec.handleEvent(event);
    } catch (error) {
        AlLogger.error('Unhandled error in handler: ', error);
        throw error;
    }
});
