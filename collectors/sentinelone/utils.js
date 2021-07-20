const RestServiceClient = require('@alertlogic/al-collector-js').RestServiceClient;
const querystring = require('querystring');

function getAPILogs(baseUrl, token, params, accumulator, maxPagesPerInvocation) {
    let pageCount = 0;
    let nextPage;

    let restServiceClient = new RestServiceClient(baseUrl);

    return new Promise(function (resolve, reject) {
        getData(params);
        function getData(params) {
            if (pageCount < maxPagesPerInvocation) {
                return restServiceClient.get(`/web/api/v2.1/activities?${querystring.stringify(params)}`, {
                    headers: {
                        "Authorization": `ApiToken ${token}`
                    }
                }).then(response => {
                    pageCount++;
                    if (response.data) {
                        accumulator.push(...response.data);
                    }
                    if (response.pagination.nextCursor) {
                        params["cursor"] = response.pagination.nextCursor;
                        getData(params);
                    }
                    else {
                        resolve({ accumulator, nextPage });
                    }
                }).catch(err => {
                    reject(err);
                });
            }
            else {
                nextPage = params.cursor;
                resolve({ accumulator, nextPage });
            }
        }
    });
}

module.exports = {
    getAPILogs: getAPILogs
};
