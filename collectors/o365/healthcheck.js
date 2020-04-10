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

const health = require('@alertlogic/al-aws-collector-js').Health;
const {
    listSubscriptions,
    startSubscription
} = require('./lib/o365_mgmnt');

/*
 * Checks the subscriptions against the configured content type. Starts the subscriptions if th
 */

function checkO365Subscriptions(callback){
    return listSubscriptions()
        .then(filterSubscriptions)
        .then(filteredStreams => {
            if(filteredStreams.length > 0){
                console.log(`O365000101: Starting subscriptions for streams ${filteredStreams.join(', ')}`);
            } else{
                console.log(`O365000102: No streams need restarted.`);
            }
            const streamPromises = filteredStreams.map(stream => startSubscription(stream));
            return Promise.all(streamPromises);
        })
        .then(res => callback(null))
        .catch(err => callback(err));
}

function filterSubscriptions(result){
    const subscriptionsList = result.parsedBody;
    const streams = JSON.parse(process.env.paws_collector_param_string_2);
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
