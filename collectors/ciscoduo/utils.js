const moment = require('moment');

const Authentication = 'Authentication';
const Administrator = 'Administrator';
const Telephony = 'Telephony';
const OfflineEnrollment = 'OfflineEnrollment';

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
                    } else {
                        if (Authentication === state.stream) {
                            if (res.response.authlogs.length > 0) {
                                accumulator.push(...res.response.authlogs);
                            }
                            if (res.response.metadata.next_offset) {
                                Object.assign(objectDetails.query, {
                                    next_offset: res.response.metadata.next_offset.join()
                                });
                                getData();
                            }
                            else return resolve({ accumulator, nextPage });
                        } else {
                            if (res.response.length > 0) {
                                accumulator.push(...res.response);
                                objectDetails.query.mintime = accumulator[accumulator.length - 1].timestamp + 1;
                                let nowMoment = moment();
                                if (moment(nowMoment.unix()).diff(objectDetails.query.mintime, 'minutes') < 60) {
                                    return resolve({ accumulator, nextPage });
                                }
                                else {
                                    getData();
                                }
                            }
                            else {
                                // Here next page is undefined;
                                return resolve({ accumulator, nextPage });
                            }
                        }
                    }
                });
            }
            else {
                nextPage = (Authentication === state.stream) ? objectDetails.query.next_offset : parseInt(objectDetails.query.mintime) + 1;
                return resolve({ accumulator, nextPage });
            }
        }
    });
}

function getAPIDetails(state) {
    let url = "";
    let typeIdPaths = [];
    let tsPaths = [{ path: ["timestamp"] }];
    let method = "GET";
    let query = {
        mintime: state.since
    };

    switch (state.stream) {
        case Authentication:
            url = `/admin/v2/logs/authentication`;
            typeIdPaths = [{ path: ['txid'] }];

            query = state.nextPage ? {
                next_offset: state.nextPage
            } : {};

            Object.assign(query, {
                mintime: state.since,
                maxtime: state.until,
                limit: 1000
            });

            break;
        case Administrator:
            url = `/admin/v1/logs/administrator`;
            typeIdPaths = [{ path: ['action'] }];
            break;
        case Telephony:
            url = `/admin/v1/logs/telephony`;
            typeIdPaths = [{ path: ['context'] }];
            break;
        case OfflineEnrollment:
            url = `/admin/v1/logs/offline_enrollment`;
            typeIdPaths = [{ path: ['action'] }];
            break;
        default:
            url = null;
    }

    return {
        url,
        typeIdPaths,
        tsPaths,
        query,
        method
    };
}

module.exports = {
    getAPIDetails: getAPIDetails,
    getAPILogs: getAPILogs
};
