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

exports.handler = CarbonblackCollector.makeHandler(async function (event, context) {
    debug('input event: ', event);
    AlLogger.defaultMeta = { requestId: context.awsRequestId };
    try {
        const creds = await CarbonblackCollector.load();
        var carbonblackc = new CarbonblackCollector(context, creds);
        await carbonblackc.handleEvent(event);
    } catch (error) {
        AlLogger.error(`Error handling event: ${error.message}`);
        throw error;
    }
});
