const RestServiceClient = require('@alertlogic/al-collector-js').RestServiceClient;
const querystring = require('querystring');


function getAPILogs(baseUrl, token, tenant_Id, state, accumulator, maxPagesPerInvocation) {
    let pageCount = 0;
    let nextPage;

    let params = {
        "from": state.since,
        "to": state.until
    };

    params = state.nextPage ? Object.assign(params, {
        pageFromKey: state.nextPage
    }) : params;

    let restServiceClient = new RestServiceClient(baseUrl);

    return new Promise(function (resolve, reject) {
        getData(params);
        function getData(params) {
            if (pageCount < maxPagesPerInvocation) {
                return restServiceClient.get(`/common/v1/alerts?${querystring.stringify(params)}`, {
                    headers: {
                        "X-Tenant-ID": tenant_Id,
                        "Authorization": `Bearer ${token}`
                    }
                }).then(response => {
                    pageCount++;
                    if (response.items) {
                        accumulator.push(...response.items);
                    }
                    if (response.pages.nextKey) {
                        Object.assign(params, {
                            pageFromKey: response.pages.nextKey
                        });
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
                nextPage = params.pageFromKey;
                resolve({ accumulator, nextPage });
            }
        }
    });
}

function authenticate(baseUrl, client_id, client_secret) {
    let restServiceClient = new RestServiceClient(baseUrl);
    return new Promise(function (resolve, reject) {
        return restServiceClient.post(`/api/v2/oauth2/token`, {
            headers: {
                "Content-Type": `application/x-www-form-urlencoded`
            },
            body: `grant_type=client_credentials&client_id=${client_id}&client_secret=${client_secret}&scope=token`
        }).then(response => {
            resolve(response.access_token);
        }).catch(err => {
            reject(err);
        });
    });
}

function getTenantIdAndDataRegion(baseUrl, token) {
    let restServiceClient = new RestServiceClient(baseUrl);
    return new Promise(function (resolve, reject) {
        return restServiceClient.get(`/whoami/v1`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        }).then(response => {
            resolve(response);
        }).catch(err => {
            reject(err);
        });
    });
}

module.exports = {
    getAPILogs: getAPILogs,
    authenticate: authenticate,
    getTenantIdAndDataRegion: getTenantIdAndDataRegion
};
