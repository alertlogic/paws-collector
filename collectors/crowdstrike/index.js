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

exports.handler = CrowdstrikeCollector.makeHandler(async function(event, context) {
    debug('input event: ', event);
    AlLogger.defaultMeta = { requestId: context.awsRequestId };
    try {
        const creds = await CrowdstrikeCollector.load();
        var crowdstrikec = new CrowdstrikeCollector(context, creds);
        await crowdstrikec.handleEvent(event);

    } catch (error) {
        AlLogger.error(`Unhandled error in handler: ${error.message}`);
        throw error;
    }
});
