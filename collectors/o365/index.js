/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * O365 System logs extension.
 *
 * @end
 * -----------------------------------------------------------------------------
 */

const debug = require('debug') ('index');
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;

const O365Collector = require('./o365_collector').O365Collector;

exports.handler = O365Collector.makeHandler(function(event, context) {
    debug('input event: ', event);
    AlLogger.defaultMeta = {requestId: context.awsRequestId};
    O365Collector.load().then(function(creds) {
        var o365c = new O365Collector(context, creds);
        o365c.handleEvent(event);
    }).catch(error => {
        AlLogger.error(`O365000006 error in creating object ${error}`);
        return error;
    });
});
