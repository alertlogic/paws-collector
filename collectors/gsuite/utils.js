const { google } = require("googleapis");

function listEvents(auth, params, accumulator, callback) {
  const service = google.admin({ version: "reports_v1", auth });

  service.activities.list(params, (err, res) => {
    if (accumulator.length == 0) {
      if (err) {
        return callback(err, null);
      }
      if (!("items" in res.data)) {
        return callback(null, []);
      }
    }

    if ("items" in res.data) {
      accumulator.push(...res.data.items);
    }

    if (!("nextPageToken" in res.data)) {
      return callback(null, accumulator);
    }

    params["pageToken"] = res.data.nextPageToken;

    listEvents(auth, params, accumulator, callback);
  });
}

module.exports = {
  listEvents: listEvents
};
