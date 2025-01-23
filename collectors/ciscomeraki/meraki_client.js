const axios = require('axios');
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;

const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const AlAwsUtil = require('@alertlogic/al-aws-collector-js').Util;

const NETWORKS_PER_PAGE = 1000;
const EVENTS_PER_PAGE = 500;
const API_THROTTLING_ERROR = 429;
const DEFAULT_RETRY_DELAY_MILLIS = 1000;
const PRODUCT_TYPE_NOTAPPLICABLE_MESSAGE = "productType is not applicable to this network";

async function getAPILogs(apiDetails, accumulator, apiEndpoint, state, clientSecret, maxPagesPerInvocation) {
    let nextPage;
    let pageCount = 0;
    let since;
    return new Promise(async (resolve, reject) => {
        try {
            for (const productType of apiDetails.productTypes) {
                pageCount = 0;
                since = state.since;
                await getData(productType);
            }
            return resolve({ accumulator, nextPage });
        } catch (error) {
            reject(error);
        }
    });

    async function getData(productType) {
        if (pageCount < maxPagesPerInvocation) {
            pageCount++;
            try {
                if (state.networkId) {
                    let url = `https://${apiEndpoint}${apiDetails.url}/${state.networkId}/events`;
                    let response = await makeApiCall(url, clientSecret, EVENTS_PER_PAGE, productType, since);
                    let data = response && response.data ? response.data.events : [];
                    if (data.length) {
                        accumulator = accumulator.concat(data);
                    }
                    const linkHeader = response && response.headers ? response.headers.link : undefined;
                    if (linkHeader && linkHeader.includes('rel=next')) {
                        const nextLink = linkHeader.match(/<(.*?)>; rel=next/)[1];
                        startingAfter = new URL(nextLink).searchParams.get('startingAfter');
                        since = startingAfter;
                        await getData(productType);
                    } else {
                        AlLogger.debug(`CMRI000006 No More Next Page Data Available`);
                        state.until = response.data.pageEndAt;
                    }
                }
                else {
                    throw new Error(`CMRI000007 Error:NetworkId required in ${url}`);
                }
            } catch (error) {
                if (error && error.response && error.response.data && (error.response.data.errors == PRODUCT_TYPE_NOTAPPLICABLE_MESSAGE)) {
                    AlLogger.warn(`CMRI0000027 ${productType} ${error.response.data.errors} : ${state.networkId}`);
                } else {
                    throw error;
                }
            }
        } else {
            nextPage = since;
        }
    }
}

async function makeApiCall(url, apiKey, perPage, productType, startingAfter = null) {
    let fullUrl = `${url}`

    if (perPage) {
        fullUrl += `?perPage=${perPage}`;
    }
    if (productType) {
        fullUrl += `&productType=${productType}`;
    }
    if (startingAfter) {
        fullUrl += `&startingAfter=${startingAfter}`;
    }
    AlLogger.debug(`CMRI0000012 Meraki fullUrl:', ${fullUrl}`);
    try {
        const response = await axios.get(fullUrl, {
            headers: {
                "X-Cisco-Meraki-API-Key": apiKey,
                "Accept": "application/json"
            },
        });
        return response;
    } catch (error) {
        throw error;
    }
}

async function listNetworkIds(payloadObj) {
    const resourcePath = `/api/v1/organizations/${payloadObj.orgKey}/networks`;

    try {
        const networks = await fetchAllNetworks(resourcePath, payloadObj.clientSecret, payloadObj.apiEndpoint);
        return networks.map(network => network.id);
    } catch (error) {
        return error;
    }
}

async function fetchAllNetworks(resourcePath, apiKey, apiEndpoint) {
    let delay = DEFAULT_RETRY_DELAY_MILLIS; // Initial delay of 1 second
    async function attemptApiCall() {
        try {
            let response = await makeApiCall(`https://${apiEndpoint}/${resourcePath}`, apiKey, NETWORKS_PER_PAGE);
            return response.data;
        } catch (error) {
            if (error.response && error.response.status === API_THROTTLING_ERROR) {
                // Rate limit exceeded, applying exponential backoff
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2;
                return attemptApiCall();
            } else {
                throw error;
            }
        }
    }
    return attemptApiCall();
}

function getOrgKeySecretEndPoint(collector) {
    const clientSecret = collector.secret;
    if (!clientSecret) {
        return "The Client Secret was not found!";
    }
    const apiEndpoint = collector.apiEndpoint;
    const orgKey = collector.orgKey;
    if (!orgKey) {
        return "orgKey was not found!";
    }
    return { clientSecret, apiEndpoint, orgKey };
}

function getAPIDetails(orgKey, productTypes) {
    let url = "/api/v1/networks";
    let method = "GET";
    let requestBody = "";
    return {
        url,
        method,
        requestBody,
        orgKey,
        productTypes
    };
}

function differenceOfNetworksArray(newNetworks, oldNetworks) {
    return newNetworks.filter(network => oldNetworks.indexOf(network) === -1);
}

async function fetchJsonFromS3Bucket(bucketName, fileName, callback) {
    try {
        const s3Client = new S3Client();
        const getObjectParams = {
            Bucket: bucketName,
            Key: fileName
        };
        const response = await s3Client.send(new GetObjectCommand(getObjectParams));

        let jsonData = '';
        for await (const chunk of response.Body) {
            jsonData += chunk.toString();
        }
        const parsedData = JSON.parse(jsonData);
        return parsedData;
    } catch (error) {
        return error;
    }
}

async function getS3ObjectParams(keyValue, data) {
    let params = {
        data: data,
        key: keyValue,
        bucketName: process.env.dl_s3_bucket_name
    }
    return params;
}

async function uploadNetworksListInS3Bucket(keyValue, networks) {
    if (networks.length > 0) {
        let params = await getS3ObjectParams(keyValue, networks);
        uploadToS3Bucket(params, (err) => {
            AlLogger.debug(`CMRI0000010 error while uploading the ${keyValue} : ${JSON.stringify(params)}`);
            if (err) {
                return err;
            }
        });
    }
}

function uploadToS3Bucket({ data, key, bucketName }, callback) {
    let bucket = bucketName ? bucketName : process.env.dl_s3_bucket_name;
    if (bucket) {
        AlAwsUtil.uploadS3Object({ data, key, bucket }, (err) => {
            if (err) {
                AlLogger.warn(`CMRI0000013 error while uploading the ${key} object in ${bucket} bucket : ${JSON.stringify(err)}`);
            }
            return callback(null);
        });
    }
    else return callback(`CMRI0000011 error uploading to ${bucket} bucket`);
}

module.exports = {
    getAPIDetails: getAPIDetails,
    makeApiCall: makeApiCall,
    getAPILogs: getAPILogs,
    listNetworkIds: listNetworkIds,
    fetchAllNetworks: fetchAllNetworks,
    getOrgKeySecretEndPoint: getOrgKeySecretEndPoint,
    uploadNetworksListInS3Bucket: uploadNetworksListInS3Bucket,
    getS3ObjectParams: getS3ObjectParams,
    uploadToS3Bucket: uploadToS3Bucket,
    fetchJsonFromS3Bucket: fetchJsonFromS3Bucket,
    differenceOfNetworksArray: differenceOfNetworksArray
};