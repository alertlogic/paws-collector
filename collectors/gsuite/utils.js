const { google } = require("googleapis");

function listEvents(auth, params, accumulator, maxPagesPerInvocation) {
    const service = google.admin({ version: "reports_v1", auth });
    let pageCount = 0;
    let nextPage;
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
                        resolve({ accumulator, nextPage });
                    }

                }).catch(error => {
                    reject(error);
                });
            }
            else {
                    nextPage=params.pageToken;
                    resolve({ accumulator, nextPage });
            }
        }
    });
}

module.exports = {
    listEvents: listEvents
};
