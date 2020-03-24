/* -----------------------------------------------------------------------------
 * @copyright (C) 2020, Alert Logic, Inc
 * @doc
 *
 * carbonblack class.
 *
 * @end
 * -----------------------------------------------------------------------------
 */
'use strict';

const moment = require('moment');
const PawsCollector = require('@alertlogic/paws-collector').PawsCollector;
const calcNextCollectionInterval = require('@alertlogic/paws-collector').calcNextCollectionInterval;
const parse = require('@alertlogic/al-collector-js').Parse;
const utils = require("./utils");


let typeIdPaths = [];

let tsPaths = [];


class CarbonblackCollector extends PawsCollector {

    pawsInitCollectionState(event, callback) {
        const startTs = process.env.paws_collection_start_ts ?
            process.env.paws_collection_start_ts :
            moment().toISOString();
        const endTs = moment(startTs).add(this.pollInterval, 'seconds').toISOString();
        const apiNames = JSON.parse(process.env.paws_collector_param_string_1);
        const initialStates = apiNames.map(apiName => {
            return {
                apiName,
                since: startTs,
                until: endTs,
                nextPage: null,
                poll_interval_sec: 1
            }
        });
        return callback(null, initialStates, 1);

    }

    pawsGetRegisterParameters(event, callback) {
        const regValues = {
            carbonblackAPINames: process.env.paws_collector_param_string_1,
            carbonblackOrgKey: process.env.paws_collector_param_string_2
        };

        callback(null, regValues);
    }

    pawsGetLogs(state, callback) {

        let collector = this;

        const clientSecret = JSON.parse(collector.secret);
        if (!clientSecret) {
            return callback("The Client Secret was not found!");
        }

        const clientId = JSON.parse(collector.clientId);
        if (!clientId) {
            return callback("The Client ID was not found!");
        }

        const apiEndpoint = process.env.paws_endpoint.replace(/^https:\/\/|\/$/g, '');
        const orgKey = process.env.paws_collector_param_string_2;
        const apiDetails = utils.getAPIDetails(state, orgKey);

        if (!apiDetails.url) {
            return callback("The API name was not found!");
        }

        typeIdPaths = apiDetails.typeIdPaths;
        tsPaths = apiDetails.tsPaths;

        console.info(`CABL000001 Collecting data for ${state.apiName} from ${state.since} till ${state.until}`);

        utils.getAPILogs(apiDetails, [], apiEndpoint, state, clientSecret, clientId, process.env.paws_max_pages_per_invocation)
            .then(({ accumulator, nextPage }) => {
                let newState;
                if (nextPage === undefined) {
                    newState = this._getNextCollectionState(state);
                } else {
                    newState = this._getNextCollectionStateWithNextPage(state, nextPage);
                }
                console.info(`CABL000002 Next collection in ${newState.poll_interval_sec} seconds`);
                return callback(null, accumulator, newState, newState.poll_interval_sec);
            })
            .catch((error) => {
                return callback(error);
            });


    }

    _getNextCollectionState(curState) {

        const untilMoment = moment(curState.until);

        const { nextUntilMoment, nextSinceMoment, nextPollInterval } = calcNextCollectionInterval('hour-day-progression', untilMoment, this.pollInterval);

        return {
            apiName: curState.apiName,
            since: nextSinceMoment.toISOString(),
            until: nextUntilMoment.toISOString(),
            nextPage: null,
            poll_interval_sec: nextPollInterval
        };
    }

    _getNextCollectionStateWithNextPage({ apiName, since, until }, nextPage) {
        return {
            apiName,
            since,
            until,
            nextPage,
            poll_interval_sec: 1
        };
    }

    pawsFormatLog(msg) {
        let collector = this;

        const ts = parse.getMsgTs(msg, tsPaths);
        const typeId = parse.getMsgTypeId(msg, typeIdPaths);

        let formattedMsg = {
            messageTs: ts.sec,
            priority: 11,
            progName: 'CarbonblackCollector',
            message: JSON.stringify(msg),
            messageType: 'json/carbonblack',
            application_id: collector.application_id
        };

        if (typeId !== null && typeId !== undefined) {
            formattedMsg.messageTypeId = `${typeId}`;
        }
        if (ts.usec) {
            formattedMsg.messageTsUs = ts.usec;
        }
        return formattedMsg;
    }
}

module.exports = {
    CarbonblackCollector: CarbonblackCollector
}
