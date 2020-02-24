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

module.exports = {
    PawsCollector : require('./paws_collector').PawsCollector,
    calcNextCollectionInterval : require('./paws_utils').calcNextCollectionInterval
};
