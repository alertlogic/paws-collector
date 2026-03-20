/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * Sophos System logs extension.
 *
 * @end
 * -----------------------------------------------------------------------------
 */

const debug = require('debug') ('index');
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;
const SophosCollector = require('./collector').SophosCollector;

exports.handler = SophosCollector.makeHandler(async function(event, context) {
    debug('input event: ', event);
    AlLogger.defaultMeta = { requestId: context.awsRequestId };
    try {
        const creds = await SophosCollector.load();
        let sophosc = new SophosCollector(context, creds);
        await sophosc.handleEvent(event);
    } catch (error) {
        AlLogger.error("Unhandled error in handler execution", error);
        throw error;
    };
});
