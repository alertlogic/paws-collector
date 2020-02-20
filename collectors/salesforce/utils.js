var jsforce = require('jsforce');


function getObjectLogs(response, query, maxPagesPerInvocation) {
    return new Promise(function (resolve, reject) {
        var ret = JSON.parse(response.body)
        var conn = new jsforce.Connection({
            accessToken: ret.access_token,
            instanceUrl: ret.instance_url
        });
        conn.query(query, function (err, result) {
            if (err) { reject(err); }
            resolve(result.records);
        });
    });
}

function getObjectQuery(state) {
    let query = "";
    let tsPaths = [];
    switch (state.object) {
        case "LoginHistory":
            query = `SELECT Id, UserId, LoginUrl, LoginTime FROM LoginHistory WHERE UserId in (SELECT Id FROM User) AND LoginTime > ${state.since} AND LoginTime < ${state.until}`;
            tsPaths = [{ path: ["LoginTime"] }];
            break;
        case "LoginGeo":
            query = `SELECT Id, City, PostalCode, Country, LoginTime FROM LoginGeo WHERE LoginTime > ${state.since} AND LoginTime < ${state.until}`;
            tsPaths = [{ path: ["LoginTime"] }];
            break;
        default:
            query = null;
    }

    return {
        query,
        tsPaths
    };
}

module.exports = {
    getObjectLogs: getObjectLogs,
    getObjectQuery: getObjectQuery
};
