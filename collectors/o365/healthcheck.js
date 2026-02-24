/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * O365 health checks.
 *
 * @end
 * -----------------------------------------------------------------------------
 */

'use strict';

const util = require('util');
const al_health = require('@alertlogic/al-aws-collector-js').Health
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;

/*
 * Checks the subscriptions against the configured content type. Starts the subscriptions if th
 */

async function checkO365Subscriptions() {
    let collector = this;
    try {
        const result = await collector.o365_mgmnt_client.listSubscriptions(null);
        const filteredStreams = filterSubscriptions(result);

        if (filteredStreams.length > 0) {
            AlLogger.info(`O365000101: Starting subscriptions for streams ${filteredStreams.join(', ')}`);
        } else {
            AlLogger.info(`O365000102: No streams need restarted.`);
            return;
        }

        const streamPromises = filteredStreams.map(stream => collector.o365_mgmnt_client.startSubscription(stream));
        return await Promise.all(streamPromises);
    } catch (error) {
        AlLogger.debug(`O365000103: Error in checkO365Subscriptions: ${util.inspect(error, {depth: 5})}`);
        let errorString;
        try {
            errorString = JSON.stringify(error, Object.getOwnPropertyNames(error));
        }
        catch (stringifyError) {
            errorString = error.toJSON ? error.toJSON() :
                error.message ? error.message :
                    util.inspect(error);
        }
        throw al_health.errorMsg('O365000103', 'Bad O365 stream status: ' + errorString);
    }
}

function filterSubscriptions(result){
    const subscriptionsList = result.parsedBody;
    const streams = JSON.parse(process.env.collector_streams);
    return streams.filter(stream => {
        return !subscriptionsList.some(sub => {
            return sub.contentType === stream &&
                sub.status === 'enabled';
        });
    });
}

module.exports = {
    checkO365Subscriptions
};
