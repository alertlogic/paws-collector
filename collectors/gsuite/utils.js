const { google } = require("googleapis");

function listEvents(auth, params, accumulator, maxPagesPerInvocation) {
    const service = google.admin({ version: "reports_v1", auth });
    let pageCount = 0;
    let nextPageToken = {};
    let applicationName = params.applicationName;
    return new Promise(function (resolve, reject) {
        getGsuiteData(params);
        function getGsuiteData(params) {
            if (pageCount < maxPagesPerInvocation) {
                service.activities.list(params).then(response => {
                    pageCount++;
                    if (response.data['items']) {
                        accumulator.push(...response.data.items);
                    }
                    if (response.data['nextPageToken']) {
                        params["pageToken"] = response.data.nextPageToken;
                        getGsuiteData(params);
                    }
                    else {
                        resolve({ accumulator, nextPageToken });
                    }

                }).catch(error => {
                    reject(error);
                });
            }
            else {
                    nextPageToken[applicationName]=params.pageToken ;
                    resolve({ accumulator, nextPageToken });
            }
        }
    });
}

module.exports = {
    listEvents: listEvents
};
