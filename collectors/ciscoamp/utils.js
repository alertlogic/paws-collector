const RestServiceClient = require('@alertlogic/al-collector-js').RestServiceClient;
var url = require("url");

const Audit_Logs = 'AuditLogs';
const Events = 'Events';

function getAPILogs(baseUrl, authorization, apiUrl, state, accumulator, maxPagesPerInvocation) {
    let pageCount = 0;
    let nextPage;
    let resetSeconds = null;
    let totalLogsCount = state.totalLogsCount;
    let discardFlag = false;

    let restServiceClient = new RestServiceClient(baseUrl);

    return new Promise(function (resolve, reject) {
        getData();
        function getData() {
            if (pageCount < maxPagesPerInvocation) {
                return restServiceClient.get(apiUrl, {
                    headers: {
                        "authorization": `Basic ${authorization}`
                    },
                    resolveWithFullResponse: true
                }).then(({ headers, body }) => {
                    pageCount++;
                    if (parseInt(headers['x-ratelimit-remaining']) < 200) {
                        resetSeconds = parseInt(headers['x-ratelimit-reset']);
                    }
                    if (state.stream === Events && totalLogsCount !== 0 && totalLogsCount !== body.metadata.results.total) {
                        discardFlag = true;
                        totalLogsCount = body.metadata.results.total;
                        resolve({ accumulator: [], nextPage, resetSeconds, totalLogsCount, discardFlag });
                    }
                    else {
                        if (state.stream === Events && totalLogsCount === 0) {
                            //This condition works when first time call 
                            totalLogsCount = body.metadata.results.total;
                        }
                        if (body.data) {
                            accumulator.push(...body.data);
                        }
                        if (body.metadata.links.next) {
                            apiUrl = url.parse(body.metadata.links.next).path;
                            getData();
                        }
                        else {
                            resolve({ accumulator, nextPage, resetSeconds, totalLogsCount, discardFlag });
                        }
                    }
                }).catch(err => {
                    reject(err);
                });
            }
            else {
                nextPage = apiUrl;
                resolve({ accumulator, nextPage, resetSeconds, totalLogsCount, discardFlag });
            }
        }
    });
}

function getAPIDetails(state) {
    let url = "";
    let typeIdPaths = [];
    let tsPaths = [];

    switch (state.stream) {
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
