var jsforce = require('jsforce');


function getObjectLogs(response, query, accumulator, nextPageOffset, maxPagesPerInvocation) {
    let pageCount = 0;
    let nextPage;
    let limit = 100;
    let offset = nextPageOffset ? nextPageOffset : 0;
    return new Promise(function (resolve, reject) {
        getSalesforceData();
        function getSalesforceData() {
            if (pageCount < maxPagesPerInvocation) {
                var ret = JSON.parse(response.body)
                var conn = new jsforce.Connection({
                    accessToken: ret.access_token,
                    instanceUrl: ret.instance_url
                });
                queryWithLimit = `${query} LIMIT ${limit} OFFSET ${offset}`;
                conn.query(queryWithLimit, function (err, result) {
                    if (err) { return reject(err); }
                    if (result.records.length === 0) {
                        return resolve({ accumulator, nextPage });
                    }
                    accumulator.push(...result.records);
                    offset = offset + limit;
                    pageCount++;
                    return getSalesforceData();
                });
            }
            else {
                nextPage = offset;
                return resolve({ accumulator, nextPage });
            }
        }
    });
}

function getObjectQuery(state) {
    let query = "";
    let tsPaths = [];
    switch (state.object) {
        case "LoginHistory":
            query = `SELECT Id, UserId, TlsProtocol, Status, SourceIp, Platform, LoginUrl, LoginType, LoginTime, LoginGeoId, CountryIso, CipherSuite, ClientVersion, Browser, AuthenticationServiceId, Application, APIVersion, ApiType, LoginGeo.City, LoginGeo.Country, LoginGeo.CountryIso, LoginGeo.Latitude, LoginGeo.LoginTime, LoginGeo.Longitude, LoginGeo.PostalCode, LoginGeo.Subdivision FROM LoginHistory WHERE UserId in (SELECT Id FROM User) AND LoginTime > ${state.since} AND LoginTime < ${state.until}`;
            tsPaths = [{ path: ["LoginTime"] }];
            break;
        case "EventLogFile":
            query = `SELECT EventType, LogDate FROM EventLogFile`;
            tsPaths = [{ path: ["LogDate"] }];
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
