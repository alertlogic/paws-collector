/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * Mimecast System logs extension.
 *
 * @end
 * -----------------------------------------------------------------------------
 */

const debug = require('debug')('index');
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;
const MimecastCollector = require('./collector').MimecastCollector;

exports.handler = MimecastCollector.makeHandler(async function (event, context) {
    debug('input event: ', event);
    AlLogger.defaultMeta = { requestId: context.awsRequestId };
    try {
        const creds = await MimecastCollector.load();
        let mimecastc = new MimecastCollector(context, creds);
        await mimecastc.handleEvent(event)

    } catch (error) {
        AlLogger.error('Unhandled error in handler: ', error);
        throw error;
    }
});
