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

exports.handler = SentineloneCollector.makeHandler(function(event, context) {
    debug('input event: ', event);
    AlLogger.defaultMeta = { requestId: context.awsRequestId };
    SentineloneCollector.load().then(function(creds) {
        var sentinelonec = new SentineloneCollector(context, creds);
        sentinelonec.handleEvent(event);
    });
});
