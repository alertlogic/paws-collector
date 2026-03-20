/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * Cisco Meraki System logs extension.
 *
 * @end
 * -----------------------------------------------------------------------------
 */

const debug = require('debug')('index');
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;
const CiscomerakiCollector = require('./collector').CiscomerakiCollector;

exports.handler = CiscomerakiCollector.makeHandler(async function (event, context) {
    debug('input event: ', event);
    AlLogger.defaultMeta = { requestId: context.awsRequestId };
    var ciscomerakic;
    try {
        const creds = await CiscomerakiCollector.load();
        ciscomerakic = new CiscomerakiCollector(context, creds);
        await ciscomerakic.handleEvent(event);
    } catch (error) {
        AlLogger.error(`Error in handler: ${error.message}`);
        throw error;
    }
});
