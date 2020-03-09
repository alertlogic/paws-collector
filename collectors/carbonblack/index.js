/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * Carbonblack System logs extension.
 *
 * @end
 * -----------------------------------------------------------------------------
 */

const debug = require('debug') ('index');

const CarbonblackCollector = require('./collector').CarbonblackCollector;

exports.handler = function(event, context) {
    debug('input event: ', event);
    CarbonblackCollector.load().then(function(creds) {
        var carbonblackc = new CarbonblackCollector(context, creds);
        carbonblackc.handleEvent(event);
    });
};
