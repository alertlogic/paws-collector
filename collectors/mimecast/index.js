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

const MimecastCollector = require('./collector').MimecastCollector;

exports.handler = MimecastCollector.makeHandler(function(event, context) {
    debug('input event: ', event);
    MimecastCollector.load().then(function(creds) {
        var mimecastc = new MimecastCollector(context, creds);
        mimecastc.handleEvent(event);
    });
});
