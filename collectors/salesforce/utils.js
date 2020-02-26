var jsforce = require('jsforce');


function getObjectLogs(response, query, accumulator, lastPageLastId, maxPagesPerInvocation) {
    let pageCount = 0;
    let nextPage;
    let limit = 1000;
    let lastId = lastPageLastId ? lastPageLastId : null;
    return new Promise(function (resolve, reject) {
        getSalesforceData();
        function getSalesforceData() {
            if (pageCount < maxPagesPerInvocation) {
                var ret = JSON.parse(response.body)
                var conn = new jsforce.Connection({
                    accessToken: ret.access_token,
                    instanceUrl: ret.instance_url,
                    version: "48.0"
                });
                let queryWithLimit = lastId ? `${query} AND Id > '${lastId}'` : query;
                queryWithLimit = `${queryWithLimit} ORDER BY Id ASC LIMIT ${limit}`;
                conn.query(queryWithLimit, function (err, result) {
                    if (err) { return reject(err); }
                    if (result.records.length === 0) {
                        return resolve({ accumulator, nextPage });
                    }
                    accumulator.push(...result.records);
                    lastId = accumulator[accumulator.length - 1].Id;
                    pageCount++;
                    return getSalesforceData();
                });
            }
            else {
                nextPage = lastId;
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
            query = `SELECT Id, EventType, Interval, LogFile, LogFileContentType, LogFileFieldNames, LogFileFieldTypes, LogFileLength, Sequence, LogDate FROM EventLogFile WHERE ( EventType = 'Login' OR EventType = 'API' OR EventType = 'Logout' ) AND LogDate > ${state.since} AND LogDate < ${state.until}`;
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
