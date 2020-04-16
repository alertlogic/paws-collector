const utils = require("../utils");
const assert = require('assert');
const moment = require('moment');

describe('Unit Tests', function () {
    describe('Get API Details', function () {
        it('Get API Details', function (done) {
            const startDate = moment().subtract(5, 'minutes');
            let resourceDetailsArray = [];
            const resourceNames = JSON.parse(process.env.paws_collector_param_string_1);
            resourceNames.map(resource => {
                let state = {
                    resource: resource,
                    since: startDate.toISOString(),
                    until: startDate.add(5, 'minutes').toISOString(),
                    poll_interval_sec: 1
                };
                const APIDetails = utils.getAPIDetails(state);
                assert.notEqual(APIDetails.url, null);
                resourceDetailsArray.push(APIDetails);
            });
            assert(resourceDetailsArray.length == resourceNames.length, "resourceDetailsArray length is wrong");
            done();
        });
        it('Get API Details check url is null', function (done) {
            const startDate = moment().subtract(5, 'minutes');
            let state = {
                resource: "resource",
                since: startDate.toISOString(),
                until: startDate.add(5, 'minutes').toISOString(),
                poll_interval_sec: 1
            };
            const APIDetails = utils.getAPIDetails(state);
            assert.equal(APIDetails.url, null);
            done();
        });
    });
});
