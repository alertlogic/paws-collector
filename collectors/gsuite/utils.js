const { google } = require("googleapis");
const ALERTS = 'alerts';

function listEvents(auth, params, accumulator, maxPagesPerInvocation) {
    const service = google.admin({ version: "reports_v1", auth });
    let pageCount = 0;
    let nextPage;
    return new Promise(function (resolve, reject) {
        getGsuiteData(params);
        function getGsuiteData(params) {
            if (pageCount < maxPagesPerInvocation) {
                service.activities.list(params).then(response => {
                    pageCount++;
                    if (response.data['items']) {
                        accumulator.push(...response.data.items);
                    }
                    if (response.data['nextPageToken']) {
                        params["pageToken"] = response.data.nextPageToken;
                        getGsuiteData(params);
                    }
                    else {
                        resolve({ accumulator, nextPage });
                    }

                }).catch(error => {
                    reject(error);
                });
            }
            else {
                nextPage = params.pageToken;
                resolve({ accumulator, nextPage });
            }
        }
    });
}

function listAlerts(auth, params, accumulator, maxPagesPerInvocation) {
    const service = google.alertcenter({ version: 'v1beta1', auth });
    let pageCount = 0;
    let nextPage;
    return new Promise(function (resolve, reject) {
        getGsuiteAlertsData(params);
        function getGsuiteAlertsData(params) {
            if (pageCount < maxPagesPerInvocation) {
                service.alerts.list(params).then(response => {
                    pageCount++;
                    if (response.data['alerts']) {
                        accumulator.push(...response.data.alerts);
                    }
                    if (response.data['nextPageToken']) {
                        params["pageToken"] = response.data.nextPageToken;
                        getGsuiteAlertsData(params);
                    }
                    else {
                        resolve({ accumulator, nextPage });
                    }

                }).catch(error => {
                    reject(error);
                });
            }
            else {
                nextPage = params.pageToken;
                resolve({ accumulator, nextPage });
            }
        }
    });
}

function getTypeIdAndTsPaths(stream) {
    let typeIdPaths = [];
    let tsPaths = [];

    switch (stream) {
        case ALERTS:
            typeIdPaths = [{ path: ["data","@type"] }];
            tsPaths =  [{ path: ["createTime"] }];
            break;
        default:
            typeIdPaths = [{ path: ["kind"] }];
            tsPaths =  [{ path: ["id", "time"] }];
    }
    return {
        typeIdPaths,
        tsPaths
    };
    
}

module.exports = {
    listEvents: listEvents,
    listAlerts: listAlerts,
    getTypeIdAndTsPaths:getTypeIdAndTsPaths
};
