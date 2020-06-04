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
                        return reject(res.message);
                    } else {
                        if (Authentication === state.object) {
                            if (res.response.authlogs > 0) {
                                accumulator.push(...res.response.authlogs);
                            }
                            if (res.response.metadata.next_offset) {
                                objectDetails.query = {
                                    next_offset: res.response.metadata.next_offset,
                                    limit: 1000
                                };
                                getData();
                            }
                            else {
                                return resolve({ accumulator, nextPage });
                            }

                        } else {
                            if (res.response.length > 0) {
                                accumulator.push(...res.response);
                                objectDetails.query.mintime = accumulator[accumulator.length - 1].timestamp + 1;
                                getData();
                            }
                            else {
                                nextPage = objectDetails.query.mintime;
                                return resolve({ accumulator, nextPage });
                            }
                        }
                    }
                });
            }
            else {
                if (Authentication === state.object) {
                    nextPage = objectDetails.query.next_offset;
                }
                else {
                    nextPage = objectDetails.query.mintime;
                }
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
        mintime: state.mintime
    };;


    switch (state.object) {
        case Authentication:
            url = `/admin/v2/logs/authentication`;
            typeIdPaths = [];
            if (state.nextPage) {
                query = {
                    next_offset: state.nextPage,
                    limit: 1000
                };
            } else {
                query = {
                    mintime: state.mintime,
                    maxtime: state.maxtime,
                    limit: 1000
                };
            }
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
            typeIdPaths = [];
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
