/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * Ciscoamp System logs extension.
 *
 * @end
 * -----------------------------------------------------------------------------
 */

const debug = require('debug') ('index');
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;
const CiscoampCollector = require('./collector').CiscoampCollector;

exports.handler = CiscoampCollector.makeHandler(function(event, context) {
    debug('input event: ', event);
    AlLogger.defaultMeta = { requestId: context.awsRequestId };
    CiscoampCollector.load().then(function(creds) {
        var ciscoampc = new CiscoampCollector(context, creds);
        ciscoampc.handleEvent(event);
    });
});
