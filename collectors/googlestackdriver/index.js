/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * Googlestackdriver System logs extension.
 *
 * @end
 * -----------------------------------------------------------------------------
 */

const debug = require('debug') ('index');
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;
const GooglestackdriverCollector = require('./collector').GooglestackdriverCollector;

exports.handler = GooglestackdriverCollector.makeHandler(function(event, context) {
    debug('input event: ', event);
    AlLogger.defaultMeta = { requestId: context.awsRequestId };
    GooglestackdriverCollector.load().then(function(creds) {
        var googlestackdriverc = new GooglestackdriverCollector(context, creds);
        googlestackdriverc.handleEvent(event);
    });
});
