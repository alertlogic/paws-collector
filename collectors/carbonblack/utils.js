var request = require('request');

const Audit_Log_Events = 'AuditLogEvents';
const Search_Alerts = 'SearchAlerts';
const Search_Alerts_CB_Analytics = 'SearchAlertsCBAnalytics';
const Search_Alerts_Vmware = 'SearchAlertsVmware';
const Search_Alerts_Watchlist = 'SearchAlertsWatchlist';

function getAPILogs(apiDetails, accumulator, state, clientSecret, clientId, maxPagesPerInvocation) {
    let nextPage;
    if (apiDetails.method === "GET") {
        return new Promise(function (resolve, reject) {
            request({
                url: apiDetails.url,
                method: apiDetails.method,
                headers: {
                    'X-Auth-Token': `${clientSecret}/${clientId}`
                },
            }, (err, response) => {
                if (err) {
                    return reject(err);
                }
                response.body = JSON.parse(response.body);
                if (response.body.notifications === undefined || response.body.notifications === null) {
                    return reject(response.body.message);
                }
                if (response.body.notifications.length === 0) {
                    return resolve({ accumulator, nextPage });
                }
                accumulator.push(...response.body.notifications);
                return resolve({ accumulator, nextPage });
            });

        });
    }
    else {
        let pageCount = 0;
        let limit = 1;
        let offset = state.nextPage ? state.nextPage : 1;
        apiDetails.requestBody.rows = limit;
        apiDetails.requestBody.start = offset;
        return new Promise(function (resolve, reject) {
            getCarbonBlackData();
            function getCarbonBlackData() {
                if (pageCount < maxPagesPerInvocation) {
                    request({
                        url: apiDetails.url,
                        method: apiDetails.method,
                        headers: {
                            'X-Auth-Token': `${clientSecret}/${clientId}`
                        },
                        json: apiDetails.requestBody
                    }, (err, response) => {
                        if (err) {
                            return reject(err);
                        }
                        if (response.body.results === undefined || response.body.results === null) {
                            return reject(response.body.message);
                        }
                        if (response.body.results.length === 0) {
                            return resolve({ accumulator, nextPage });
                        }
                        accumulator.push(...response.body.results);
                        offset = offset + limit;
                        apiDetails.requestBody.start = offset;
                        pageCount++;
                        return getCarbonBlackData();
                    });
                }
                else {
                    nextPage = offset;
                    return resolve({ accumulator, nextPage });
                }
            }
        });
    }

}

function getAPIDetails(state, apiEndpoint, orgKey) {
    let url = "";
    let method = "GET";
    let requestBody = "";
    let typeIdPaths = [];
    let tsPaths = [];
    switch (state.apiName) {
        case Audit_Log_Events:
            url = `${apiEndpoint}/integrationServices/v3/auditlogs`;
            typeIdPaths = [{ path: ["eventId"] }];
            tsPaths = [{ path: ["eventTime"] }];
            break;
        case Search_Alerts:
            url = `${apiEndpoint}/appservices/v6/orgs/${orgKey}/alerts/_search`;
            typeIdPaths = [{ path: ["id"] }];
            tsPaths = [{ path: ["last_update_time"] }];
            method = "POST";
            requestBody = {
                "criteria": {
                    "create_time": {
                        "end": state.until,
                        "start": state.since
                    },
                },
                "rows": 0,
                "start": 0
            };
            break;
        case Search_Alerts_CB_Analytics:
            url = `${apiEndpoint}/appservices/v6/orgs/${orgKey}/alerts/cbanalytics/_search`;
            typeIdPaths = [{ path: ["id"] }];
            tsPaths = [{ path: ["last_update_time"] }];
            method = "POST";
            requestBody = {
                "criteria": {
                    "create_time": {
                        "end": state.until,
                        "start": state.since
                    },
                },
                "rows": 0,
                "start": 0
            };
            break;
        case Search_Alerts_Vmware:
            url = `${apiEndpoint}/appservices/v6/orgs/${orgKey}/alerts/vmware/_search`;
            typeIdPaths = [{ path: ["id"] }];
            tsPaths = [{ path: ["last_update_time"] }];
            method = "POST";
            requestBody = {
                "criteria": {
                    "create_time": {
                        "end": state.until,
                        "start": state.since
                    },
                },
                "rows": 0,
                "start": 0
            };
            break;
        case Search_Alerts_Watchlist:
            url = `${apiEndpoint}/appservices/v6/orgs/${orgKey}/alerts/watchlist/_search`;
            typeIdPaths = [{ path: ["id"] }];
            tsPaths = [{ path: ["last_update_time"] }];
            method = "POST";
            requestBody = {
                "criteria": {
                    "create_time": {
                        "end": state.until,
                        "start": state.since
                    },
                },
                "rows": 0,
                "start": 0
            };
            break;
        default:
            url = null;
    }
    return {
        url,
        method,
        requestBody,
        typeIdPaths,
        tsPaths
    };
}

module.exports = {
    getAPIDetails: getAPIDetails,
    getAPILogs: getAPILogs
};
