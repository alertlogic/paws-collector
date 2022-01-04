/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * Sophossiem System logs extension.
 *
 * @end
 * -----------------------------------------------------------------------------
 */

const debug = require('debug') ('index');
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;
const SophossiemCollector = require('./collector').SophossiemCollector;

exports.handler = SophossiemCollector.makeHandler(function(event, context) {
    debug('input event: ', event);
    AlLogger.defaultMeta = { requestId: context.awsRequestId };
    SophossiemCollector.load().then(function(creds) {
        var sophossiemc = new SophossiemCollector(context, creds);
        sophossiemc.handleEvent(event);
    });
});
