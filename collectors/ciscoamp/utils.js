const RestServiceClient = require('@alertlogic/al-collector-js').RestServiceClient;
var url = require("url");

const Audit_Logs = 'AuditLogs';
const Events = 'Events';

function getAPILogs(baseUrl, authorization, apiUrl, accumulator, maxPagesPerInvocation) {
    let pageCount = 0;
    let nextPage;

    let restServiceClient = new RestServiceClient(baseUrl);

    return new Promise(function (resolve, reject) {
        getData();
        function getData() {
            if (pageCount < maxPagesPerInvocation) {
                return restServiceClient.get(apiUrl, {
                    headers: {
                        "authorization": `Basic ${authorization}`
                    }
                }).then(response => {
                    pageCount++;
                    if (response.data) {
                        accumulator.push(...response.data);
                    }
                    if (response.metadata.links.next) {
                        apiUrl = url.parse(response.metadata.links.next).path;
                        getData();
                    }
                    else {
                        resolve({ accumulator, nextPage });
                    }
                }).catch(err => {
                    reject(err);
                });
            }
            else {
                nextPage = apiUrl;
                resolve({ accumulator, nextPage });
            }
        }
    });
}

function getAPIDetails(state) {
    let url = "";
    let typeIdPaths = [];
    let tsPaths = [];

    switch (state.resource) {
        case Audit_Logs:
            url = `/v1/audit_logs?start_time=${state.since}&end_time=${state.until}`;
            typeIdPaths = [{ path: ["audit_log_id"] }];
            tsPaths = [{ path: ["created_at"] }];
            break;
        case Events:
            url = `/v1/events?start_date=${state.since}`;
            typeIdPaths = [{ path: ["id"] }];
            tsPaths = [{ path: ["date"] }];
            break;
        default:
            url = null;
    }

    return {
        url,
        typeIdPaths,
        tsPaths
    };
}

module.exports = {
    getAPILogs: getAPILogs,
    getAPIDetails: getAPIDetails
};
