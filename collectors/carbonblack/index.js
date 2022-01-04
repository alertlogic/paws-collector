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
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;
const CarbonblackCollector = require('./collector').CarbonblackCollector;

exports.handler = CarbonblackCollector.makeHandler(function(event, context) {
    debug('input event: ', event);
    AlLogger.defaultMeta = { requestId: context.awsRequestId };
    CarbonblackCollector.load().then(function(creds) {
        var carbonblackc = new CarbonblackCollector(context, creds);
        carbonblackc.handleEvent(event);
    });
});
