const moment = require('moment');

const Authentication = 'Authentication';
const Administrator = 'Administrator';
const Telephony = 'Telephony';
const OfflineEnrollment = 'OfflineEnrollment';
const MIN_13_DIGIT_TIMESTAMP = 1e12

// All v2 log endpoints share the same next_offset + mintime/maxtime/limit query shape.
// The < 1e12 guard handles any old 10-digit SQS messages still in-flight during rollout.
function buildOffsetQuery(state) {
    const query = state.nextPage ? { next_offset: state.nextPage } : {};
    const sinceMs = state.since < MIN_13_DIGIT_TIMESTAMP ? state.since * 1000 : state.since;
    const untilMs = state.until != null
        ? (state.until < MIN_13_DIGIT_TIMESTAMP ? state.until * 1000 : state.until)
        : sinceMs + 60000;  // fallback: +1 min for any in-flight state missing `until`
    Object.assign(query, {
        mintime: sinceMs,
        maxtime: untilMs,
        limit: 1000
    });
    return query;
}

function isOfflineAction(item) {
    return item.action && item.action.name && item.action.name.startsWith('o2fa_');
}

function getAPILogs(client, objectDetails, state, accumulator, maxPagesPerInvocation) {
    let pageCount = 0;
    let nextPage;

    return new Promise(function (resolve, reject) {
        getData();
        function getData() {
            if (pageCount < maxPagesPerInvocation) {
                pageCount++;
                return client.jsonApiCall(objectDetails.method, objectDetails.url, objectDetails.query, function (res) {
                    if (res.stat !== 'OK') {
                        return reject(res);
                    }
                    if (Authentication === state.stream) {
                        // Auth v2: response body uses `authlogs` array;
                        if (res.response.authlogs.length > 0) {
                            accumulator.push(...res.response.authlogs);
                        }
                        if (res.response.metadata.next_offset) {
                            Object.assign(objectDetails.query, {
                                next_offset: res.response.metadata.next_offset.join()
                            });
                            getData();
                        } else {
                            return resolve({ accumulator, nextPage });
                        }
                    } else {
                        // Activity (Administrator/OfflineEnrollment) and Telephony v2:
                        // response body uses `items` array; next_offset is a plain string.
                        const items = (res.response && res.response.items) ? res.response.items : [];

                        let filteredItems;
                        if (OfflineEnrollment === state.stream) {
                            // Keep only offline enrollment actions (o2fa_*) to avoid
                            // duplicating records already collected by the Administrator stream.
                            filteredItems = items.filter(isOfflineAction);
                        } else if (Administrator === state.stream) {
                            // Exclude offline enrollment actions to avoid duplicating
                            // records already collected by the OfflineEnrollment stream.
                            filteredItems = items.filter(item => !isOfflineAction(item));
                        } else {
                            // Telephony uses a dedicated endpoint — no cross-stream overlap.
                            filteredItems = items;
                        }

                        if (filteredItems.length > 0) {
                            accumulator.push(...filteredItems);
                        }
                        if (res.response.metadata && res.response.metadata.next_offset) {
                            Object.assign(objectDetails.query, {
                                next_offset: res.response.metadata.next_offset
                            });
                            getData();
                        } else {
                            return resolve({ accumulator, nextPage });
                        }
                    }
                });
            } else {
                // Preserve next_offset for all streams so callers can resume pagination.
                nextPage = objectDetails.query.next_offset || null;
                return resolve({ accumulator, nextPage });
            }
        }
    });
}

function getAPIDetails(state) {
    let url = null;
    let typeIdPaths = [];
    let tsPaths = [{ path: ['timestamp'] }];
    const method = 'GET';

    switch (state.stream) {
        case Authentication:
            url = '/admin/v2/logs/authentication';
            typeIdPaths = [{ path: ['txid'] }];
            break;
        case Administrator:
            url = '/admin/v2/logs/activity';
            typeIdPaths = [{ path: ['activity_id'] }];
            tsPaths = [{ path: ['ts'] }];
            break;
        case Telephony:
            url = '/admin/v2/logs/telephony';
            typeIdPaths = [{ path: ['telephony_id'] }];
            tsPaths = [{ path: ['ts'] }];
            break;
        case OfflineEnrollment:
            url = '/admin/v2/logs/activity';
            typeIdPaths = [{ path: ['activity_id'] }];
            tsPaths = [{ path: ['ts'] }];
            break;
    }

    const query = buildOffsetQuery(state);

    return { url, typeIdPaths, tsPaths, query, method };
}

module.exports = {
    getAPIDetails: getAPIDetails,
    getAPILogs: getAPILogs,
    MIN_13_DIGIT_TIMESTAMP: MIN_13_DIGIT_TIMESTAMP
};
