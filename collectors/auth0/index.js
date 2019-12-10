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
    Auth0Collector.load().then(function({aimsCreds, pawsCreds}) {
        var auth0c = new Auth0Collector(context, aimsCreds, pawsCreds);
        auth0c.handleEvent(event);
    });
};
