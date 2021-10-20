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

const CiscoampCollector = require('./collector').CiscoampCollector;

exports.handler = CiscoampCollector.makeHandler(function(event, context) {
    debug('input event: ', event);
    CiscoampCollector.load().then(function(creds) {
        var ciscoampc = new CiscoampCollector(context, creds);
        ciscoampc.handleEvent(event);
    });
});
