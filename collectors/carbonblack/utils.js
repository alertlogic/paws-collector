const RestServiceClient = require('@alertlogic/al-collector-js').RestServiceClient;

const Audit_Log_Events = 'AuditLogEvents';
const Search_Alerts = 'SearchAlerts';
const Search_Alerts_CB_Analytics = 'SearchAlertsCBAnalytics';
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
                            'X-Auth-Token': `${clientSecret}/${clientId}`,
                            'Content-Type': 'application/json'
                        },
                        data: apiDetails.requestBody
                    }).then(response => {
                        accumulator.push(...response.results);
                        offset = offset + limit;
                        if (response.results.length > 0 && response.num_found >= offset) {
                            apiDetails.requestBody.start = offset;
                            pageCount++;
                            return getCarbonBlackData();
                        }
                        return resolve({ accumulator, nextPage });
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
            url = `/api/alerts/v7/orgs/${orgKey}/alerts/_search`;
            typeIdPaths = [{ path: ["id"] }];
            tsPaths = [{ path: ["backend_update_timestamp"] }];
            method = "POST";
            requestBody = {
                "time_range": {
                    "start": state.since,
                    "end": state.until
                },
                "rows": 0,
                "start": 0,
                "exclusions": {
                    "type": ["CB_ANALYTICS", "WATCHLIST"]
                }
            };
            break;
        case Search_Alerts_CB_Analytics:
            url = `/api/alerts/v7/orgs/${orgKey}/alerts/_search`;
            typeIdPaths = [{ path: ["id"] }];
            tsPaths = [{ path: ["backend_update_timestamp"] }];
            method = "POST";
            requestBody = {
                "time_range": {
                    "start": state.since,
                    "end": state.until
                },
                "criteria": {
                    "type": ["CB_ANALYTICS"]
                },
                "rows": 0,
                "start": 0
            };
            break;
        case Search_Alerts_Watchlist:
            url = `/api/alerts/v7/orgs/${orgKey}/alerts/_search`;
            typeIdPaths = [{ path: ["id"] }];
            tsPaths = [{ path: ["backend_update_timestamp"] }];
            method = "POST";
            requestBody = {
                "time_range": {
                    "start": state.since,
                    "end": state.until
                },
                "criteria": {
                    "type": [
                        "WATCHLIST"
                    ]
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
