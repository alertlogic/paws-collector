const RestServiceClient = require('@alertlogic/al-collector-js').RestServiceClient;
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const moment = require('moment');

const Siem_Logs = 'SiemLogs';
const Attachment_Protect_Logs = 'AttachmentProtectLogs';
const URL_Protect_Logs = 'URLProtectLogs';
const Malware_Feed = 'MalwareFeed';


function getAPILogs(authDetails, state, accumulator, maxPagesPerInvocation) {
    let pageCount = 0;
    let nextPage = state.nextPage ? state.nextPage : undefined;

    let restServiceClient = new RestServiceClient(authDetails.baseUrl);

    return new Promise(function (resolve, reject) {
        getData();
        function getData() {
            if (pageCount < maxPagesPerInvocation) {

                let applicationDetails = getAPIDetails(state, nextPage);
                if (!applicationDetails.uri) {
                    reject("The application name was not found!");
                }

                let headers = generateHeaders(authDetails, applicationDetails.uri);

                restServiceClient.post(applicationDetails.uri, {
                    headers: headers,
                    json: applicationDetails.payload,
                    resolveWithFullResponse: true
                }).then(({ headers, body }) => {
                    pageCount++;
                    //will change this response code once we get creds
                    switch (state.applicationName) {
                        case Siem_Logs:
                            if (body.meta.isLastToken) {
                                nextPage = undefined;
                                return resolve({ accumulator, nextPage });
                            }
                            if (headers['mc-siem-token']) {
                                nextPage = headers['mc-siem-token'];
                            }
                            accumulator.push(...body.json());
                            break;
                        case Malware_Feed:
                            if (body.objects.length === 0) {
                                nextPage = undefined;
                                return resolve({ accumulator, nextPage });
                            }
                            if (body.id) {
                                nextPage = body.id;
                            }
                            accumulator.push(...body.objects);
                            break;
                        case Attachment_Protect_Logs:
                        case URL_Protect_Logs:
                            if (body.fail.errors) {
                                return reject(body.fail.errors);
                            }
                            if (state.applicationName === Attachment_Protect_Logs && body.data.attachmentLogs) {
                                accumulator.push(...body.data.attachmentLogs);
                            }
                            if (state.applicationName === URL_Protect_Logs && body.data.clickLogs) {
                                accumulator.push(...body.data.clickLogs);
                            }
                            if (body.meta.pagination.next) {
                                nextPage = body.meta.pagination.next;
                            } else {
                                nextPage = undefined;
                                return resolve({ accumulator, nextPage });
                            }
                            break;
                    }
                    getData();
                }).catch(err => {
                    return reject(err);
                });
            }
            else {
                return resolve({ accumulator, nextPage });
            }
        }
    });
}

function getAPIDetails(state, nextPage) {
    let uri = "";
    let payload = "";
    switch (state.applicationName) {
        case Siem_Logs:
            uri = `/api/audit/get-siem-logs`;
            if (nextPage === undefined) {
                payload = {
                    "data": [
                        {
                            'type': 'MTA',
                            'fileFormat': 'JSON',
                            'compress': true
                        }
                    ]
                };
            }
            else {
                payload = {
                    "data": [
                        {
                            'type': 'MTA',
                            'token': nextPage,
                            'fileFormat': 'JSON',
                            'compress': true
                        }
                    ]
                };

            }
            break;
        case Attachment_Protect_Logs:
        case URL_Protect_Logs:

            if (state.applicationName === Attachment_Protect_Logs) {
                uri = `/api/ttp/attachment/get-logs`;
            }

            if (state.applicationName === URL_Protect_Logs) {
                uri = `/api/ttp/url/get-logs`;
            }

            if (nextPage === undefined) {
                payload = {
                    "meta": {
                        "pagination": {
                            "pageSize": 100
                        }
                    },
                    "data": [
                        {
                            "oldestFirst": true,
                            "from": state.since,
                            "route": "all",
                            "to": state.until
                            // "result": "all"
                        }
                    ]
                };
            }
            else {
                payload = {
                    "meta": {
                        "pagination": {
                            "pageSize": 100,
                            "pageToken": nextPage
                        }
                    },
                    "data": [
                        {
                            "oldestFirst": true,
                            "from": state.since,
                            "route": "all",
                            "to": state.until
                            // "result": "all"
                        }
                    ]
                };
            }
            break;
        case Malware_Feed:
            uri = `/api/ttp/threat-intel/get-feed`;
            if (nextPage === undefined) {
                payload = {
                    "data": [
                        {
                            "end": state.until,
                            "fileType": "stix",
                            "start": state.since,
                            "feedType": "malware_customer"
                        }
                    ]
                };
            }
            else {
                payload = {
                    "data": [
                        {
                            "end": state.until,
                            "fileType": "stix",
                            "start": state.since,
                            "token": nextPage,
                            "feedType": "malware_customer"
                        }
                    ]
                };
            }
            break;
        default:
            uri = null;
    }

    return {
        uri,
        payload
    };
}

function generateHeaders(authDetails, uri) {
    let requestId = uuidv4();
    let hdrDate = moment().utc().format('ddd, DD MMM YYYY HH:mm:ss z');

    let hmac = crypto.createHmac("sha1", Buffer.from(authDetails.secretKey, 'base64').toString('utf-8'));
    hmac.update(`${hdrDate}:${requestId}:${uri}:${authDetails.appKey}`);
    let signature = hmac.digest("base64");

    return {
        "Authorization": `MC ${authDetails.accessKey}:${signature}`,
        "x-mc-app-id": authDetails.appId,
        "x-mc-date": hdrDate,
        "x-mc-req-id": requestId,
        "Content-Type": 'application/json'
    };
}

module.exports = {
    getAPILogs: getAPILogs
};
