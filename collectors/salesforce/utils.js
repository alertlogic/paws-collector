var jsforce = require('jsforce');

const LOGIN_HISTORY_OBJECT = 'LoginHistory';
const EVENT_LOG_FILE_OBJECT = 'EventLogFile';
const API_EVENT_OBJECT = 'ApiEvent';
const LOGIN_EVENT_OBJECT = 'LoginEvent';
const LOGOUT_EVENT_OBJECT = 'LogoutEvent';
const LOGIN_AS_OBJECT = 'LoginAsEvent';

function getObjectLogs(response, objectQueryDetails, accumulator, state, maxPagesPerInvocation) {
    let pageCount = 0;
    let nextPage;
    let limit = 1000;
    let lastValue = state.nextPage ? state.nextPage : null;
    return new Promise(function (resolve, reject) {
        getSalesforceData();
        function getSalesforceData() {
            if (pageCount < maxPagesPerInvocation) {
                var conn = new jsforce.Connection({
                    accessToken: response.access_token,
                    instanceUrl: response.instance_url,
                    version: "48.0"
                });
                let queryWithLimit = "";
                switch (state.stream) {
                    case LOGIN_HISTORY_OBJECT:
                    case EVENT_LOG_FILE_OBJECT:
                        queryWithLimit = lastValue ? `${objectQueryDetails.query} AND ${objectQueryDetails.sortFieldName} > '${lastValue}'` : objectQueryDetails.query;
                        break;
                    case API_EVENT_OBJECT:
                    case LOGIN_EVENT_OBJECT:
                    case LOGOUT_EVENT_OBJECT:
                    case LOGIN_AS_OBJECT:
                        queryWithLimit = lastValue ? `${objectQueryDetails.query} AND ${objectQueryDetails.sortFieldName} < ${lastValue}` : `${objectQueryDetails.query} AND ${objectQueryDetails.sortFieldName} < ${state.until}`;
                        break;
                }
                queryWithLimit = `${queryWithLimit} ORDER BY ${objectQueryDetails.sortFieldName} ${objectQueryDetails.sortType} LIMIT ${limit}`;
                conn.query(queryWithLimit, function (err, result) {
                    if (err) { return reject(err); }
                    if (result.records.length === 0) {
                        return resolve({ accumulator, nextPage });
                    }
                    accumulator.push(...result.records);
                    lastValue = accumulator[accumulator.length - 1][objectQueryDetails.sortFieldName];
                    pageCount++;
                    return getSalesforceData();
                });
            }
            else {
                nextPage = lastValue;
                return resolve({ accumulator, nextPage });
            }
        }
    });
}

function getObjectQuery(state) {
    let query = "";
    let tsPaths = [];
    let sortFieldName = "Id";
    let sortType = "ASC";
    switch (state.stream) {
        case LOGIN_HISTORY_OBJECT:
            query = `SELECT Id, UserId, TlsProtocol, Status, SourceIp, Platform, LoginUrl, LoginType, LoginTime, LoginGeoId, CountryIso, CipherSuite, ClientVersion, Browser, AuthenticationServiceId, Application, APIVersion, ApiType, LoginGeo.City, LoginGeo.Country, LoginGeo.CountryIso, LoginGeo.Latitude, LoginGeo.LoginTime, LoginGeo.Longitude, LoginGeo.PostalCode, LoginGeo.Subdivision FROM LoginHistory WHERE UserId in (SELECT Id FROM User) AND LoginTime >= ${state.since} AND LoginTime < ${state.until}`;
            tsPaths = [{ path: ["LoginTime"] }];
            break;
        case EVENT_LOG_FILE_OBJECT:
            query = `SELECT Id, EventType, Interval, LogFile, LogFileContentType, LogFileFieldNames, LogFileFieldTypes, LogFileLength, Sequence, LogDate FROM EventLogFile WHERE ( EventType = 'Login' OR EventType = 'API' OR EventType = 'Logout' ) AND LogDate >= ${state.since} AND LogDate < ${state.until}`;
            tsPaths = [{ path: ["LogDate"] }];
            break;
        case API_EVENT_OBJECT:
            query = `SELECT Id, Application, EventDate, Platform, SessionLevel, SourceIp, UserId, Username FROM ApiEvent WHERE EventDate >= ${state.since}`;
            tsPaths = [{ path: ["EventDate"] }];
            sortFieldName = 'EventDate';
            sortType = 'DESC';
            break;
        case LOGIN_EVENT_OBJECT:
            query = `SELECT Id, Application, Browser, City, Country, EventDate, LoginLatitude, LoginLongitude, LoginType, Platform, SessionLevel, SourceIp, Status, UserId, Username, UserType FROM LoginEvent WHERE EventDate >= ${state.since}`;
            tsPaths = [{ path: ["EventDate"] }];
            sortFieldName = 'EventDate';
            sortType = 'DESC';
            break;
        case LOGOUT_EVENT_OBJECT:
            query = `SELECT Id, EventDate, SessionLevel, SourceIp, UserId, Username FROM LogoutEvent WHERE EventDate >= ${state.since}`;
            tsPaths = [{ path: ["EventDate"] }];
            sortFieldName = 'EventDate';
            sortType = 'DESC';
            break;
        case LOGIN_AS_OBJECT:
            query = `SELECT Id, Application, Browser, EventDate, LoginType, Platform, SessionLevel, SourceIp, UserId, Username, UserType FROM LoginAsEvent WHERE EventDate >= ${state.since}`;
            tsPaths = [{ path: ["EventDate"] }];
            sortFieldName = 'EventDate';
            sortType = 'DESC';
            break;
        default:
            query = null;
    }

    return {
        query,
        tsPaths,
        sortFieldName,
        sortType
    };
}

module.exports = {
    getObjectLogs: getObjectLogs,
    getObjectQuery: getObjectQuery
};
