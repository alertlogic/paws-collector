/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * Gsuite System logs extension.
 *
 * @end
 * -----------------------------------------------------------------------------
 */

const debug = require('debug') ('index');
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;
const GsuiteCollector = require('./collector').GsuiteCollector;

exports.handler = GsuiteCollector.makeHandler(function(event, context) {
    debug('input event: ', event);
    AlLogger.defaultMeta = { requestId: context.awsRequestId };
    GsuiteCollector.load().then(function(creds) {
        var gsuitec = new GsuiteCollector(context, creds);
        gsuitec.handleEvent(event);
    });
});
