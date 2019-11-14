/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * Lambda function for polling 3rd party service log API and ingest retrieved data
 * into Alert Logic backend.
 *
 * @end
 * -----------------------------------------------------------------------------
 */

const debug = require('debug') ('index');

const AlAwsCollector = require('al-aws-collector-js').AlAwsCollector;
const PawsCollector = require('./paws_collector').PawsCollector;

exports.handler = function(event, context) {
    debug('input event: ', event);
    AlAwsCollector.load().then(function(creds) {
        var paws = new PawsCollector(context, creds);
        paws.handleEvent(event);
    });
};
