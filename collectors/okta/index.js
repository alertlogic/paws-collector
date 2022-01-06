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
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;
const OktaCollector = require('./okta_collector').OktaCollector;

exports.handler = OktaCollector.makeHandler(function(event, context) {
    debug('input event: ', event);
    AlLogger.defaultMeta = { requestId: context.awsRequestId };
    OktaCollector.load().then(function(creds) {
        var oktac = new OktaCollector(context, creds);
        oktac.handleEvent(event);
    });
});
