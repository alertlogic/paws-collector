/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * Okta System logs extension.
 *
 * @end
 * -----------------------------------------------------------------------------
 */

const debug = require('debug') ('index');

const OktaCollector = require('./okta_collector').OktaCollector;

exports.handler = function(event, context) {
    debug('input event: ', event);
    OktaCollector.load().then(function({aimsCreds, pawsCreds}) {
        var oktac = new OktaCollector(context, aimsCreds, pawsCreds);
        oktac.handleEvent(event);
    });
};