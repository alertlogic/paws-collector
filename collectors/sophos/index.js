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

exports.handler = SophosCollector.makeHandler(function(event, context) {
    debug('input event: ', event);
    AlLogger.defaultMeta = { requestId: context.awsRequestId };
    SophosCollector.load().then(function(creds) {
        var sophosc = new SophosCollector(context, creds);
        sophosc.handleEvent(event);
    });
});
