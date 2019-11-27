/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * Auth0 System logs collector.
 *
 * @end
 * -----------------------------------------------------------------------------
 */

const debug = require('debug') ('index');

const Auth0Collector = require('./auth0_collector').Auth0Collector;

exports.handler = function(event, context) {
    debug('input event: ', event);
    Auth0Collector.load().then(function(creds) {
        var auth0c = new Auth0Collector(context, creds, 'auth0');
        auth0c.handleEvent(event, function(err) {
            auth0c.done(err);
        });
    });
};
