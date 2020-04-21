const RestServiceClient = require('@alertlogic/al-collector-js').RestServiceClient;
var url = require("url");

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

module.exports = {
    getAPILogs: getAPILogs
};
