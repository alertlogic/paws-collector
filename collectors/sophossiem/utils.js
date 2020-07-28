const RestServiceClient = require('@alertlogic/al-collector-js').RestServiceClient;
const querystring = require('querystring');

const Events = 'Events';
const Alerts = 'Alerts';


function getAPILogs(BaseAPIURL, headers, state, accumulator, maxPagesPerInvocation) {
    let pageCount = 0;
    let nextPage;
    let has_more = false;
    let APIURL;

    let startParams = state.nextPage ? { cursor: state.nextPage, limit: 1000 } : { from_date: state.from_date, limit: 1000 };

    let restServiceClient = new RestServiceClient(BaseAPIURL);

    switch (state.objectName) {
        case Events:
            APIURL = `/siem/v1/events`;
            break;
        case Alerts:
            APIURL = `/siem/v1/alerts`;
            break;
    }

    return new Promise(function (resolve, reject) {
        getData(startParams);
        function getData(params) {
            if (pageCount < maxPagesPerInvocation) {
                return restServiceClient.get(`${APIURL}?${querystring.stringify(params)}`, {
                    headers: headers
                }).then(response => {
                    pageCount++;
                    if (response.items) {
                        accumulator.push(...response.items);
                    }
                    if (response.has_more) {
                        params = { cursor: response.next_cursor, limit: 1000 };
                        getData(params);
                    }
                    else {
                        nextPage = response.next_cursor;
                        resolve({ accumulator, nextPage, has_more });
                    }
                }).catch(err => {
                    reject(err);
                });
            }
            else {
                nextPage = params.cursor;
                has_more = true;
                resolve({ accumulator, nextPage, has_more });
            }
        }
    });
}

module.exports = {
    getAPILogs: getAPILogs
};
