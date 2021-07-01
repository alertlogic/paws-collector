const RestServiceClient = require('@alertlogic/al-collector-js').RestServiceClient;

function authenticate(baseUrl, client_id, client_secret) {
    let restServiceClient = new RestServiceClient(baseUrl);
    return new Promise(function (resolve, reject) {
        return restServiceClient.post(`/oauth2/token`, {
            headers: {
                "Accept": `application/json`,
                "Content-Type": `application/x-www-form-urlencoded`
            },
            body: {
                "client_id": client_id,
                "client_secret": client_secret
            }
        }).then(response => {
            resolve(response.access_token);
        }).catch(err => {
            reject(err);
        });
    });
}

module.exports = {
    authenticate: authenticate
};
