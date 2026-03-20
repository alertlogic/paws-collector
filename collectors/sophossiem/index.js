/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * Sophossiem System logs extension.
 *
 * @end
 * -----------------------------------------------------------------------------
 */

const debug = require('debug')('index');
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;
const SophossiemCollector = require('./collector').SophossiemCollector;

exports.handler = SophossiemCollector.makeHandler(async function (event, context) {
    debug('input event: ', event);
    AlLogger.defaultMeta = { requestId: context.awsRequestId };
    try {
        const creds = await SophossiemCollector.load();
        let sophossiemc = new SophossiemCollector(context, creds);
        await sophossiemc.handleEvent(event);
    } catch (error) {
        AlLogger.error("Unhandled error in handler execution", error);
        throw error;
    }
});
