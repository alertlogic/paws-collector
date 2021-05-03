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

const o365_mgmnt = require('./lib/o365_mgmnt');
const al_health = require('@alertlogic/al-aws-collector-js').Health

/*
 * Checks the subscriptions against the configured content type. Starts the subscriptions if th
 */

function checkO365Subscriptions(callback){
    return o365_mgmnt.listSubscriptions()
        .then(filterSubscriptions)
        .then(filteredStreams => {
            if(filteredStreams.length > 0){
                console.info(`O365000101: Starting subscriptions for streams ${filteredStreams.join(', ')}`);
            } else{
                console.info(`O365000102: No streams need restarted.`);
            }
            const streamPromises = filteredStreams.map(stream => o365_mgmnt.startSubscription(stream));
            return Promise.all(streamPromises);
        })
        .then(res => callback(null))
        .catch(error => {
            let errorString;
            try{
                errorString = JSON.stringify(error);
            }
            catch (stringifyError){
                errorString = error.toJSON ? error.toJSON() :
                    error.message ? error.message :
                        util.inspect(error);
            }
            callback(al_health.errorMsg('O365000103', 'Bad O365 stream status: ' + errorString));
        });
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
