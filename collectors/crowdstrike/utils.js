const RestServiceClient = require('@alertlogic/al-collector-js').RestServiceClient;
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;
const ALERTS = 'Alerts';
const USERAGENT = 'alertlogic_security_1.0';

function authenticate(baseUrl, clientId, clientSecret) {
    let restServiceClient = new RestServiceClient(baseUrl);
    const formData = new URLSearchParams();
    formData.append('client_id', clientId);
    formData.append('client_secret', clientSecret);
    return new Promise(function (resolve, reject) {
        return restServiceClient.post(`/oauth2/token`, {
            headers: {
                'User-Agent': USERAGENT,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: formData
        }).then(response => {
            resolve(response.access_token);
        }).catch(err => {
            reject(err);
        });
    });
}

function getList(apiDetails, accumulator, apiEndpoint, token) {
    let restServiceClient = new RestServiceClient(apiEndpoint);

    return new Promise(function (resolve, reject) {
        restServiceClient.get(apiDetails.url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'User-Agent': USERAGENT
            }
        }).then(response => {
            const total = response.meta.pagination.total;
            if (response.resources.length === 0) {
                return resolve({ accumulator, total });
            }
            accumulator = response.resources;
            return resolve({ accumulator, total });

        }).catch(err => {
            return reject(err);
        });
    });

}

/**
 * 
 * @param {*} ids - The ids of the alerts to retrieve.
 * @param {*} apiHostName - The crowdstrike base url. 
 * @param {*} token - A authorization token to make a api call.
 * @returns the Alerts details
 */
function getAlerts(ids, apiHostName, token) {
    let restServiceClient = new RestServiceClient(`${apiHostName}/alerts/entities/alerts/v2`);

    if (!ids || !ids.length) {
        return new Promise((resolve, reject) => {
            resolve({
                resources: []
            });
        });
    }
    return new Promise(function (resolve, reject) {
        const headers = {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': USERAGENT
        }
        return restServiceClient.post('', {
            headers: headers,
            data: {
                "composite_ids": ids
            }
        }).then(response => {
            resolve(response);
        }).catch(err => {
            reject(err);
        });
    });
}


function getAPIDetails(state) {
    let url = "";
    let method = "GET";
    let requestBody = "";
    let typeIdPaths = [];
    let tsPaths = [];
    let filter = '';
    switch (state.stream) {
        case ALERTS:
            filter = `product:['epp','automated-lead','thirdparty']+created_timestamp:>"${state.since}"+created_timestamp:<"${state.until}"`;
            url = `/alerts/queries/alerts/v2?limit=100&offset=${state.offset}&filter=${encodeURIComponent(filter)}`;
            typeIdPaths = [{ path: ["composite_id"] }];
            tsPaths = [{ path: ["created_timestamp"] }];
            break;
        default:
            url = null;
            AlLogger.error(`CROW000006 Not supported stream: ${state.stream}`);
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
    authenticate: authenticate,
    getAPIDetails: getAPIDetails,
    getList: getList,
    getAlerts: getAlerts
};
