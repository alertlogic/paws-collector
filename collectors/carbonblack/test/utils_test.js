const utils = require("../utils");
const assert = require('assert');
const moment = require('moment');

describe('Unit Tests', function () {
    describe('Get API Details', function () {
        it('Get API Details', function (done) {
            const startDate = moment().subtract(5, 'minutes');
            let apiDetails = [];
            const apiNames = JSON.parse(process.env.paws_collector_param_string_1);
            apiNames.map(apiName => {
                let state = {
                    apiName: apiName,
                    since: startDate.toISOString(),
                    until: startDate.add(5, 'minutes').toISOString(),
                    poll_interval_sec: 1
                };
                apiDetails.push(utils.getAPIDetails(state));
            });
            assert(apiDetails.length == apiNames.length, "apiDetails length is wrong");
            done();
        });
    });
});


