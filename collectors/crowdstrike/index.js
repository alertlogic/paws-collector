/* -----------------------------------------------------------------------------
 * @copyright (C) 2021, Alert Logic, Inc
 * @doc
 *
 * Crowdstrike System logs extension.
 *
 * @end
 * -----------------------------------------------------------------------------
 */

const debug = require('debug') ('index');
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;
const CrowdstrikeCollector = require('./collector').CrowdstrikeCollector;

exports.handler = CrowdstrikeCollector.makeHandler(function(event, context) {
    debug('input event: ', event);
    AlLogger.defaultMeta = { requestId: context.awsRequestId };
    CrowdstrikeCollector.load().then(function(creds) {
        var crowdstrikec = new CrowdstrikeCollector(context, creds);
        crowdstrikec.handleEvent(event);
    });
});
