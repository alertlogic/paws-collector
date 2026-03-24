/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * Googlestackdriver System logs extension.
 *
 * @end
 * -----------------------------------------------------------------------------
 */

const debug = require('debug') ('index');
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;
const GooglestackdriverCollector = require('./collector').GooglestackdriverCollector;

exports.handler = GooglestackdriverCollector.makeHandler(async function(event, context) {
    debug('input event: ', event);
    AlLogger.defaultMeta = { requestId: context.awsRequestId };
    try {
        const creds = await GooglestackdriverCollector.load();
        let googlestackdriverc = new GooglestackdriverCollector(context, creds);
        await googlestackdriverc.handleEvent(event);
    } catch (error) {
        AlLogger.error(`Unhandled error in handler: ${error.message}`);
        throw error;
    }
});
