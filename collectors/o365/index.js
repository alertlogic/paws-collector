/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * O365 System logs extension.
 *
 * @end
 * -----------------------------------------------------------------------------
 */

const debug = require('debug') ('index');
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;

const O365Collector = require('./o365_collector').O365Collector;

exports.handler = O365Collector.makeHandler(async function (event, context) {
    debug('input event: ', event);
    AlLogger.defaultMeta = { requestId: context.awsRequestId };
    try {
        const creds = await O365Collector.load();
        var o365c = new O365Collector(context, creds);
        await o365c.handleEvent(event);
    } catch (error) {
        AlLogger.error(`Unhandled error in handler: ${error.message}`);
        throw error;
    }
});
