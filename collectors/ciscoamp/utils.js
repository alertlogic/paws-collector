const RestServiceClient = require('@alertlogic/al-collector-js').RestServiceClient;
var url = require("url");

const Audit_Logs = 'AuditLogs';
const Events = 'Events';

function getAPILogs(baseUrl, authorization, apiUrl, state, accumulator, maxPagesPerInvocation) {
    let pageCount = 0;
    let nextPage;
    let newSince = null;

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
                }).then(({ body }) => {
                    pageCount++;

                    if (body.data) {
                        accumulator.push(...body.data);
                    }
                    if (state.stream === Events && accumulator.length > 0 && pageCount === 1) {
                        // Api return the data in desending order, so set new start date form first record if not available pull date from fallup records.
                        newSince = accumulator[0].date ? accumulator[0].date : accumulator[1].date ? accumulator[1].date : accumulator[2].date;
                        if (!newSince) {
                            reject(`CAMP000005 Date is not available in Events api response`);
                        }
                    }
                    if (body.metadata.links.next) {
                        apiUrl = url.parse(body.metadata.links.next).path;
                        getData();
                    }
                    else {
                        resolve({ accumulator, nextPage: undefined, newSince });
                    }
                }).catch(err => {
                    reject(err);
                });
            }
            else {
                nextPage = apiUrl;
                resolve({ accumulator, nextPage, newSince});
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
