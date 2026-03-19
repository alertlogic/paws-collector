/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * Ciscoamp System logs extension.
 *
 * @end
 * -----------------------------------------------------------------------------
 */

const debug = require('debug')('index');
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;
const CiscoampCollector = require('./collector').CiscoampCollector;

exports.handler = CiscoampCollector.makeHandler(async function (event, context) {
    debug('input event: ', event);
    AlLogger.defaultMeta = { requestId: context.awsRequestId };
    try {
        const creds = await CiscoampCollector.load();
        let ciscoampc = new CiscoampCollector(context, creds);
        await ciscoampc.handleEvent(event);
    } catch (error) {
        AlLogger.error('Error in handler: ', error);
        throw error;
    }
});
