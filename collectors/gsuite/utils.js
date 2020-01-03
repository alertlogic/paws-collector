const { google } = require("googleapis");

function listEvents(auth, params, accumulator) {
  const service = google.admin({ version: "reports_v1", auth });
  return new Promise(function (resolve, reject) {
    getGsuiteData(params);
    function getGsuiteData(params) {
      service.activities.list(params).then(response => {
        if (response.data['items']) {
          accumulator.push(...response.data.items);
        }
        if (response.data['nextPageToken']) {
          params["pageToken"] = response.data.nextPageToken;
          getGsuiteData(params);
        }
        else {
          resolve(accumulator);
        }
      }).catch(error => {
        reject(error);
      });
    }
  });
}

module.exports = {
  listEvents: listEvents
};
