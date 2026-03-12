/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * Gsuite System logs extension.
 *
 * @end
 * -----------------------------------------------------------------------------
 */

const debug = require('debug')('index');
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;
const GsuiteCollector = require('./collector').GsuiteCollector;

exports.handler = GsuiteCollector.makeHandler(async function (event, context) {
    debug('input event: ', event);
    AlLogger.defaultMeta = { requestId: context.awsRequestId };
    try {
        const creds = await GsuiteCollector.load();
        let gsuitec = new GsuiteCollector(context, creds);
        await gsuitec.handleEvent(event);
    } catch (error) {
        AlLogger.error('Unhandled error in handler: ', error);
        throw error;
    }
});
