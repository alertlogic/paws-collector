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
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;
const Auth0Collector = require('./auth0_collector').Auth0Collector;

exports.handler = Auth0Collector.makeHandler(function(event, context) {
    debug('input event: ', event);
    AlLogger.defaultMeta = { requestId: context.awsRequestId };
    Auth0Collector.load().then(async function (creds) {
        var auth0c = new Auth0Collector(context, creds);
        await auth0c.handleEvent(event);
    });
});
