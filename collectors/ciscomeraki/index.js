/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * Cisco Meraki System logs extension.
 *
 * @end
 * -----------------------------------------------------------------------------
 */

const debug = require('debug') ('index');
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;
const CiscomerakiCollector = require('./collector').CiscomerakiCollector;

exports.handler = CiscomerakiCollector.makeHandler(function(event, context) {
    debug('input event: ', event);
    AlLogger.defaultMeta = { requestId: context.awsRequestId };
    var ciscomerakic;
    CiscomerakiCollector.load().then(function(creds) {
        ciscomerakic = new CiscomerakiCollector(context, creds);
        ciscomerakic.handleEvent(event);
    });
});
