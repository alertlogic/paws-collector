/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * CLI driver for local collector testing.
 *
 * This driver simply exercises the collector and prints collection state and
 * logs to the console. Can be enhanced with dumping to a file or similar in
 * future.
 *
 * USAGE:
 *
 * node cli.js [ARGUMENTS]
 *
 * Command line parameters are copied one-for-one into process.env. Any parameters
 * required by YOUR collector are required here. There are no additional requirements
 * since this CLI driver is essentially orthogonal to the real collection framework.
 *
 * For Auth0, for example:
 *   REQUIRED:
 *     --paws_domain=YOUR_OAUTH_DOMAIN
 *     --paws_client_id=YOUR_OAUTH_CLIENT_ID
 *     --paws_api_secret=YOUR_OAUTH_SECRET
 *
 *   OPTIONAL:
 *     --paws_collection_start_ts="2019-11-21T00:00:00Z"
 *     --poll_interval=5
 *     --poll_count=1
 *
 * @end
 * -----------------------------------------------------------------------------
 */

// Instantiate your collector
const Collector = require('./auth0_collector').Auth0Collector;

// Environment
const debug = require('debug') ('index');
const argv = require('yargs').argv;

// Initialization
const pollInterval = argv.poll_interval ? argv.poll_interval : 5;
const pollCount = argv.poll_count ? argv.poll_count : 1;

// AIMS credentials (can be empty)
const creds = {
    access_key_id: argv.aims_access_key_id,
    secret_key: argv.aims_secret_key
};

// Copy command line arguments into process.env
process.env = argv;

// Create the collector
var c = new Collector({}, creds, true);
c.pollInterval = pollInterval;  // we need to set this b/c we don't have the CFN setting it for us

var pollsExecuted = 0;

var handleLogs = function(error, newLogs, state, nextInterval) {
    if (error) {
        console.log("ERROR: " + error);
        return null;
    }
    else {
        var formattedLogs = [];
        newLogs.forEach(function(msg) { formattedLogs.push(c.pawsFormatLog(msg)); });

        console.log(formattedLogs);
        console.log(state);
        pollsExecuted++;

        if (pollsExecuted >= pollCount) {
            console.log("Completed " + pollsExecuted + " polling calls");
            return state;
        } else {
            console.log("Initiating poll number " + (pollsExecuted+1));
            c.pawsGetLogs(state, handleLogs);
        }
    }
};

c.pawsInitCollectionState(null, function(error, state, interval) {
    if (error) {
        console.log("ERROR from pawsInitCollectionState: " + error);
    } else {
        console.log(state);
        console.log("Initiating poll number " + (pollsExecuted+1));
        c.pawsGetLogs(state, handleLogs);
    }
});


