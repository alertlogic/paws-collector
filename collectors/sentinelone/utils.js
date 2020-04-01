const RestServiceClient = require('@alertlogic/al-collector-js').RestServiceClient;
const querystring = require('querystring');

function authentication(baseUrl, tokenUrl, clientId, clientSecret) {
    let restServiceClient = new RestServiceClient(baseUrl);
    return new Promise(function (resolve, reject) {
        return restServiceClient.post(tokenUrl, {
            json: {
                "username": clientId,
                "remember_me": "true",
                "password": clientSecret
            }
        }).then(response => {
            resolve(response.data.token);
        }).catch(err => {
            reject(err);
        });
    });
}

function getAPILogs(baseUrl, token, params, accumulator, maxPagesPerInvocation) {
    let pageCount = 0;
    let nextPage;

    let restServiceClient = new RestServiceClient(baseUrl);

    return new Promise(function (resolve, reject) {
        getData(params);
        function getData(params) {
            if (pageCount < maxPagesPerInvocation) {
                return restServiceClient.get(`/web/api/v2.0/activities?${querystring.stringify(params)}`, {
                    headers: {
                        "Authorization": `Token ${token}`
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
    authentication: authentication,
    getAPILogs: getAPILogs
};
