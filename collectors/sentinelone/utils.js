const RestServiceClient = require('@alertlogic/al-collector-js').RestServiceClient;

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

module.exports = {
    authentication: authentication
};
