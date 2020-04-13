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

const SentineloneCollector = require('./collector').SentineloneCollector;

exports.handler = function(event, context) {
    debug('input event: ', event);
    SentineloneCollector.load().then(function(creds) {
        var sentinelonec = new SentineloneCollector(context, creds);
        sentinelonec.handleEvent(event);
    });
};
