/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * Mimecast System logs extension.
 *
 * @end
 * -----------------------------------------------------------------------------
 */

const debug = require('debug') ('index');
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;
const MimecastCollector = require('./collector').MimecastCollector;

exports.handler = MimecastCollector.makeHandler(function(event, context) {
    debug('input event: ', event);
    AlLogger.defaultMeta = { requestId: context.awsRequestId };
    MimecastCollector.load().then(function(creds) {
        var mimecastc = new MimecastCollector(context, creds);
        mimecastc.handleEvent(event);
    });
});
