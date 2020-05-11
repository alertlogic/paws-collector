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

const GsuiteCollector = require('./collector').GsuiteCollector;

exports.handler = GsuiteCollector.makeHandler(function(event, context) {
    debug('input event: ', event);
    GsuiteCollector.load().then(function(creds) {
        var gsuitec = new GsuiteCollector(context, creds);
        gsuitec.handleEvent(event);
    });
});
