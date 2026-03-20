/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * Ciscoduo System logs extension.
 *
 * @end
 * -----------------------------------------------------------------------------
 */

const debug = require('debug')('index');
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;
const CiscoduoCollector = require('./collector').CiscoduoCollector;

exports.handler = CiscoduoCollector.makeHandler(async function (event, context) {
    debug('input event: ', event);
    AlLogger.defaultMeta = { requestId: context.awsRequestId };
    try {
        const creds = await CiscoduoCollector.load();
        let ciscoduoc = new CiscoduoCollector(context, creds);
        await ciscoduoc.handleEvent(event);
    } catch (error) {
        AlLogger.error(`Error handling event: ${error.message}`);
        throw error;
    }
});
