const RestServiceClient = require('@alertlogic/al-collector-js').RestServiceClient;
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;

const INCIDENT = 'Incident';
const DETECTION = 'Detection';
const USERAGENT = 'alertlogic_security_1.0';

function authenticate(baseUrl, clientId, clientSecret) {
    let restServiceClient = new RestServiceClient(baseUrl);
    return new Promise(function (resolve, reject) {
        return restServiceClient.post(`/oauth2/token`, {
            form: {
                client_id: clientId,
                client_secret: clientSecret
            },
            headers: {
                'User-Agent': USERAGENT
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
                    'Authorization': `Bearer ${token}`,
                    'User-Agent': USERAGENT
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

function getIncidents(ids, apiHostName, token) {
    let restServiceClient = new RestServiceClient(`${apiHostName}/incidents/entities/incidents/GET/v1`);
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
                'Authorization': 'Bearer ' + token,
                'User-Agent': USERAGENT
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
                'Authorization': 'Bearer ' + token,
                'User-Agent': USERAGENT
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
    let filter = '';
    switch (state.stream) {
        case INCIDENT:
            filter = `end:>"${state.since}"+end:<"${state.until}"`;
            url = `/incidents/queries/incidents/v1?limit=500&offset=${state.offset}&filter=${encodeURIComponent(filter)}`;
            typeIdPaths = [{ path: ["incident_type"] }];
            tsPaths = [{ path: ["created"] }];
            break;
        case DETECTION:
            filter = `last_behavior:>"${state.since}"+last_behavior:<"${state.until}"`;
            url = `/detects/queries/detects/v1?limit=1000&offset=${state.offset}&filter=${encodeURIComponent(filter)}`;
            typeIdPaths = [];
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
    getIncidents: getIncidents,
    getDetections: getDetections,
    getAPIDetails: getAPIDetails,
    getList: getList
};
