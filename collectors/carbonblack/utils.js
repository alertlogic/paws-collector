const RestServiceClient = require('@alertlogic/al-collector-js').RestServiceClient;

const Audit_Log_Events = 'AuditLogEvents';
const Search_Alerts = 'SearchAlerts';
const Search_Alerts_CB_Analytics = 'SearchAlertsCBAnalytics';
const Search_Alerts_Vmware = 'SearchAlertsVmware';
const Search_Alerts_Watchlist = 'SearchAlertsWatchlist';

function getAPILogs(apiDetails, accumulator, apiEndpoint, state, clientSecret, clientId, maxPagesPerInvocation) {
    let nextPage;
    let restServiceClient = new RestServiceClient(apiEndpoint);
    if (apiDetails.method === "GET") {
        return new Promise(function (resolve, reject) {
            restServiceClient.get(apiDetails.url, {
                headers: {
                    'X-Auth-Token': `${clientSecret}/${clientId}`
                }
            }).then(response => {
                if (response.notifications.length === 0) {
                    return resolve({ accumulator, nextPage });
                }
                accumulator.push(...response.notifications);
                return resolve({ accumulator, nextPage });

            }).catch(err => {
                return reject(err);
            });
        });
    }
    else {
        let pageCount = 0;
        let limit = 500;
        let offset = state.nextPage ? state.nextPage : 1;
        apiDetails.requestBody.rows = limit;
        apiDetails.requestBody.start = offset;
        return new Promise(function (resolve, reject) {
            getCarbonBlackData();
            function getCarbonBlackData() {
                if (pageCount < maxPagesPerInvocation) {
                    restServiceClient.post(apiDetails.url, {
                        headers: {
                            'X-Auth-Token': `${clientSecret}/${clientId}`
                        },
                        json: apiDetails.requestBody
                    }).then(response => {
                        if (response.results.length === 0) {
                            return resolve({ accumulator, nextPage });
                        }
                        accumulator.push(...response.results);
                        offset = offset + limit;
                        apiDetails.requestBody.start = offset;
                        pageCount++;
                        return getCarbonBlackData();
                    }).catch(err => {
                        return reject(err);
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

function getAPIDetails(state, orgKey) {
    let url = "";
    let method = "GET";
    let requestBody = "";
    let typeIdPaths = [];
    let tsPaths = [];
    switch (state.stream) {
        case Audit_Log_Events:
            url = `/integrationServices/v3/auditlogs`;
            typeIdPaths = [{ path: ["eventId"] }];
            tsPaths = [{ path: ["eventTime"] }];
            break;
        case Search_Alerts:
            url = `/appservices/v6/orgs/${orgKey}/alerts/_search`;
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
            url = `/appservices/v6/orgs/${orgKey}/alerts/cbanalytics/_search`;
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
            url = `/appservices/v6/orgs/${orgKey}/alerts/vmware/_search`;
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
            url = `/appservices/v6/orgs/${orgKey}/alerts/watchlist/_search`;
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
