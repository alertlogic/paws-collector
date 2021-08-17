const RestServiceClient = require('@alertlogic/al-collector-js').RestServiceClient;

const INCIDENT = 'Incident';
const DETECTION = 'Detection';

function authenticate(baseUrl, client_id, client_secret) {
    let restServiceClient = new RestServiceClient(baseUrl);
    return new Promise(function (resolve, reject) {
        return restServiceClient.post(`/oauth2/token`, {
            form: {
                client_id: client_id,
                client_secret: client_secret
            }
        }).then(response => {
            resolve(response.access_token);
        }).catch(err => {
            reject(err);
        });
    });
}

function getList(apiDetails, accumulator, apiEndpoint, token) {
    let restServiceClient = new RestServiceClient(apiEndpoint);
    if (apiDetails.method === "GET") {
        return new Promise(function (resolve, reject) {
            restServiceClient.get(apiDetails.url, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }).then(response => {
                const total = response.meta.pagination.total;
                if (response.resources.length === 0) {
                    return resolve({ accumulator, total });
                }
                accumulator = response.resources;
                return resolve({accumulator, total});

            }).catch(err => {
                return reject(err);
            });
        });
    }
}

function getIncidents(ids, APIHostName, token) {
    let restServiceClient = new RestServiceClient(`${APIHostName}/incidents/entities/incidents/GET/v1`);
    if (!ids || !ids.length) {
        return new Promise((resolve, reject) => {
            resolve({
                resources: []
            });
        });
    }
    return new Promise(function (resolve, reject) {
        return restServiceClient.post('', {
            headers: {
                Authorization: 'Bearer ' + token
            },
            json: {
                ids: ids
            }
        }).then(response => {
            resolve(response);
        }).catch(err => {
            reject(err);
        });
    });
}

function getDetections(ids, APIHostName, token) {
    let restServiceClient = new RestServiceClient(`${APIHostName}/detects/entities/summaries/GET/v1`);
    if (!ids || !ids.length) {
        return new Promise((resolve, reject) => {
            resolve({
                resources: []
            });
        });
    }
    return new Promise(function (resolve, reject) {
        return restServiceClient.post('', {
            headers: {
                Authorization: 'Bearer ' + token
            },
            json: {
                ids: ids
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
    switch (state.stream) {
        case INCIDENT:
            url = `/incidents/queries/incidents/v1?limit=500&offset=${state.offset}&filter=start:>'${state.since}'&end:<'${state.until}'`;
            typeIdPaths = [{ path: ["incident_type"] }];
            tsPaths = [{ path: ["created"] }];
            break;
        case DETECTION:
            url = `/detects/queries/detects/v1?limit=1000&offset=${state.offset}&filter=device.first_seen:>'${state.since}'&device.last_seen:<'${state.until}'`;
            typeIdPaths = [];
            tsPaths = [{ path: ["created_timestamp"] }];
            break;
        default:
            url = null;
            console.error(`CROW000006 Not supported stream: `, state.stream);
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
    getIncidents: getIncidents,
    getDetections: getDetections,
    getAPIDetails: getAPIDetails,
    getList: getList
};
