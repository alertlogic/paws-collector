/* -----------------------------------------------------------------------------
 * @copyright (C) 2020, Alert Logic, Inc
 * @doc
 *
 * Ciscoduo System logs extension.
 *
 * @end
 * -----------------------------------------------------------------------------
 */

const debug = require('debug') ('index');

const CiscoduoCollector = require('./ciscoduo_collector').CiscoduoCollector;

exports.handler = function(event, context) {
    debug('input event: ', event);
    CiscoduoCollector.load().then(function(creds) {
        var ciscoduoc = new CiscoduoCollector(context, creds);
        ciscoduoc.handleEvent(event);
    });
};
