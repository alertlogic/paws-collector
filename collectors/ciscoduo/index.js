/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * Ciscoduo System logs extension.
 *
 * @end
 * -----------------------------------------------------------------------------
 */

const debug = require('debug') ('index');

const CiscoduoCollector = require('./collector').CiscoduoCollector;

exports.handler = CiscoduoCollector.makeHandler(function(event, context) {
    debug('input event: ', event);
    CiscoduoCollector.load().then(function(creds) {
        var ciscoduoc = new CiscoduoCollector(context, creds);
        ciscoduoc.handleEvent(event);
    });
});
