const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const moment = require('moment');
const axios = require('axios')
const AdmZip = require('adm-zip');

const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;

const Siem_Logs = 'SiemLogs';
const Attachment_Protect_Logs = 'AttachmentProtectLogs';
const URL_Protect_Logs = 'URLProtectLogs';
const Malware_Feed = 'MalwareFeed';

function getAPILogs(authDetails, state, accumulator, maxPagesPerInvocation) {
    let pageCount = 0;
    let nextPage = state.nextPage ? state.nextPage : undefined;

    return new Promise(function (resolve, reject) {
        getData();
        function getData() {
            if (pageCount < maxPagesPerInvocation) {

                let applicationDetails = getAPIDetails(state, nextPage);
                if (!applicationDetails.uri) {
                    reject("The application name was not found!");
                }

                let requestHeaders = generateHeaders(authDetails, applicationDetails.uri);
                let url = `https://${authDetails.baseUrl}${applicationDetails.uri}`;

                AlLogger.debug(`MIME00009 calling url: ${url}`);
                const tempPayload = {
                    method: 'POST',
                    url: url,
                    headers: requestHeaders,
                    data: applicationDetails.payload
                };
                const payloadData = applicationDetails.encoding === null || applicationDetails.encoding ? { ...tempPayload, responseType: 'arraybuffer', encoding: applicationDetails.encoding } : tempPayload;
                axios.request(payloadData).then(response => {
                    if (!applicationDetails.compress) {
                        body = response.data;
                        if (body.fail && body.fail[0] && body.fail[0].errors) {
                            return reject(body.fail[0].errors[0]);
                        }
                    }
                    pageCount++;
                    switch (state.stream) {
                        case Siem_Logs:
                            //get zip file content in the body and unzip it in memory
                            unzipBufferInMemory(response.data).then(function (bodyData) {
                                accumulator.push(...bodyData);
                                AlLogger.debug(`MIME000011 accumulated first element: ${JSON.stringify(accumulator[1])} and accumaulator length ${accumulator.length}`);
                                if (response.data.meta && response.data.meta.isLastToken) {
                                    nextPage = undefined;
                                    if (applicationDetails.payload.data[0].token) {
                                        nextPage = applicationDetails.payload.data[0].token;
                                    }
                                    return resolve({ accumulator, nextPage });
                                }
                            }).catch((error) => {
                                AlLogger.debug(`MIME000011 Error Accumulating Data: ${error} compress flagged: ${applicationDetails.compress}`);
                            });

                            if (response.headers && response.headers['mc-siem-token']) {
                                nextPage = response.headers['mc-siem-token'];
                            }
                            break;
                        case Malware_Feed:
                            if (response.headers && response.headers['x-mc-threat-feed-next-token']) {
                                accumulator.push(...body.objects);
                                nextPage = response.headers['x-mc-threat-feed-next-token'];
                            }
                            else {
                                nextPage = undefined;
                                //if next token is not present in responce then it will set last request token value to nextPage
                                if (applicationDetails.payload.data[0].token) {
                                    nextPage = applicationDetails.payload.data[0].token;
                                }
                                return resolve({ accumulator, nextPage });
                            }
                            break;
                        case Attachment_Protect_Logs:
                        case URL_Protect_Logs:
                            if (state.stream === Attachment_Protect_Logs && body.data && body.data[0] && body.data[0].attachmentLogs) {
                                accumulator.push(...body.data[0].attachmentLogs);
                            }
                            if (state.stream === URL_Protect_Logs && body.data && body.data[0] && body.data[0].clickLogs) {
                                accumulator.push(...body.data[0].clickLogs);
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
                }).catch(error => {
                    AlLogger.debug(`MIME000014 error in making api call ${JSON.stringify(error)}`);
                    reject(error);
                })
            }
            else {
                return resolve({ accumulator, nextPage });
            }
        }
    });
}

/**
   * Unzip the Buffer
   * 
   * @param buffer
   * @returns {Promise}
   */

function unzipBufferInMemory(buffer) {
    return new Promise(function (resolve, reject) {
        var tempAccumulator = []
        var zip = new AdmZip(buffer);
        var zipEntries = zip.getEntries();
        if (zipEntries && zipEntries.length > 0) {
            zipEntries.forEach(function (entry) {
                if (entry.name.endsWith('.json')) {
                    try {
                        let data = JSON.parse(entry.getData().toString('utf8'));
                        tempAccumulator.push(...data.data);
                    } catch (exception) {
                        AlLogger.error("MIME000010 Error parsing json file data. ", exception);
                        return reject(exception);
                    }
                }
            });
        }
        AlLogger.debug(`MIME000013 tempAccumulator data length. ${tempAccumulator.length}`);
        resolve(tempAccumulator);
    })
}

function getAPIDetails(state, nextPage) {
    let uri = "";
    let payload = "";
    let encoding = "";
    let compress = false;
    switch (state.stream) {
        case Siem_Logs:
            uri = `/api/audit/get-siem-logs`;
            encoding = null;
            compress = true;
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

            if (state.stream === Attachment_Protect_Logs) {
                uri = `/api/ttp/attachment/get-logs`;
            }

            if (state.stream === URL_Protect_Logs) {
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
                            "fileType": "stix"
                        }
                    ]
                };
            }
            else {
                payload = {
                    "data": [
                        {
                            "fileType": "stix",
                            "token": nextPage
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
        payload,
        encoding,
        compress
    };
}

function generateHeaders(authDetails, uri) {
    let requestId = uuidv4().toString();
    let hdrDate = moment().utc().format('ddd, DD MMM YYYY HH:mm:ss z');

    let hmac = crypto.createHmac("sha1", Buffer.from(authDetails.secretKey, 'base64'));
    hmac.write(`${hdrDate}:${requestId}:${uri}:${authDetails.appKey}`);
    hmac.end();       // can't read from the stream until you call end()
    signature = hmac.read().toString('base64');

    let returnObj = {
        "Authorization": `MC ${authDetails.accessKey}:${signature}`,
        "x-mc-app-id": authDetails.appId,
        "x-mc-date": hdrDate,
        "x-mc-req-id": requestId,
        "Content-Type": 'application/json'
    };

    AlLogger.debug(`MIME000012 url App Id:  ${returnObj['x-mc-app-id']}`);
    AlLogger.debug(`MIME000012 url Date:  ${returnObj['x-mc-date']}`);
    AlLogger.debug(`MIME000012 url Request ID:  ${returnObj['x-mc-req-id']}`);

    return returnObj;
}

function getTypeIdAndTsPaths(stream) {
    let typeIdPaths = [];
    let tsPaths = [];

    switch (stream) {
        case Siem_Logs:
            typeIdPaths = [{ path: ["aCode"] }];
            tsPaths = [{ path: ["datetime"] }];
            break;
        case Attachment_Protect_Logs:
            typeIdPaths = [{ path: ["definition"] }];
            tsPaths = [{ path: ["date"] }];
            break;
        case URL_Protect_Logs:
            typeIdPaths = [{ path: ["category"] }];
            tsPaths = [{ path: ["date"] }];
            break;
        case Malware_Feed:
            typeIdPaths = [{ path: ["type"] }];
            tsPaths = [{ path: ["created"] }];
            break;
    }

    return {
        typeIdPaths,
        tsPaths
    };
}

module.exports = {
    getAPILogs: getAPILogs,
    getTypeIdAndTsPaths: getTypeIdAndTsPaths,
    unzipBufferInMemory: unzipBufferInMemory
};
