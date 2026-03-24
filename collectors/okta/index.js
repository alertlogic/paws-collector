/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * Okta System logs extension.
 *
 * @end
 * -----------------------------------------------------------------------------
 */

const debug = require('debug') ('index');
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;
const OktaCollector = require('./okta_collector').OktaCollector;

exports.handler = OktaCollector.makeHandler(async function (event, context) {
    debug('input event: ', event);
    AlLogger.defaultMeta = { requestId: context.awsRequestId };
    try {
        const creds = await OktaCollector.load();
        let oktac = new OktaCollector(context, creds);
        await oktac.handleEvent(event);
    } catch (error) {
        AlLogger.error('Unhandled error in Okta Collector handler: ', error);
        throw error;
    }
});
