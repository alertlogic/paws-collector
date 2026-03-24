/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * Sentinelone System logs extension.
 *
 * @end
 * -----------------------------------------------------------------------------
 */

const debug = require('debug') ('index');
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;
const SentineloneCollector = require('./collector').SentineloneCollector;

exports.handler = SentineloneCollector.makeHandler(async function(event, context) {
    debug('input event: ', event);
    AlLogger.defaultMeta = { requestId: context.awsRequestId };
    try {
        const creds = await SentineloneCollector.load();
        let sentinelonec = new SentineloneCollector(context, creds);
        await sentinelonec.handleEvent(event);
    } catch (error) {
        AlLogger.error(`Unhandled error in handling event: ${error.message}`);
        throw error;
    }
});
