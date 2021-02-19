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
const packageJson = require('./package.json');


let typeIdPaths = [];

let tsPaths = [];


class CarbonblackCollector extends PawsCollector {

    constructor(context, creds) {
        super(context, creds, packageJson.version);
    }

    pawsInitCollectionState(event, callback) {

        const apiNames = JSON.parse(process.env.collector_streams);
        const initialStates = apiNames.map(stream => {
            let startTs = "";
            let endTs = "";
            if (stream === "AuditLogEvents") {
                startTs = moment().toISOString();
                endTs = moment(startTs).add(this.pollInterval, 'seconds').toISOString();
            }
            else {
                startTs = process.env.paws_collection_start_ts ?
                    process.env.paws_collection_start_ts :
                    moment().toISOString();
                endTs = moment(startTs).add(this.pollInterval, 'seconds').toISOString();

            }
            return {
                stream,
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
            carbonblackAPINames: process.env.collector_streams,
            carbonblackOrgKey: process.env.paws_collector_param_string_2
        };

        callback(null, regValues);
    }

    pawsGetLogs(state, callback) {
        // This code can remove once exsisting code set stream and collector_streams env variable
        if (!process.env.collector_streams) {
            this.setCollectorStreamsEnv(process.env.paws_collector_param_string_1);
        }
        if (!state.stream) {
            state = this.setStreamToCollectionState(state);
        }

        let collector = this;

        const clientSecret = collector.secret;
        if (!clientSecret) {
            return callback("The Client Secret was not found!");
        }

        const clientId = collector.clientId;
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

        console.info(`CABL000001 Collecting data for ${state.stream} from ${state.since} till ${state.until}`);

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
                // set errorCode if not available in error object to showcase client error on DDMetric
                error.errorCode = error.statusCode;
                return callback(error);
            });


    }

    _getNextCollectionState(curState) {

        const untilMoment = moment(curState.until);

        const { nextUntilMoment, nextSinceMoment, nextPollInterval } = calcNextCollectionInterval('no-cap', untilMoment, this.pollInterval);

        return {
            stream: curState.stream,
            since: nextSinceMoment.toISOString(),
            until: nextUntilMoment.toISOString(),
            nextPage: null,
            poll_interval_sec: nextPollInterval
        };
    }

    _getNextCollectionStateWithNextPage({ stream, since, until }, nextPage) {
        return {
            stream,
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

    setStreamToCollectionState(curState) {
        return {
            stream: curState.apiName,
            since: curState.since,
            until: curState.until,
            nextPage: curState.nextPage,
            poll_interval_sec: curState.poll_interval_sec
        };
    }
}

module.exports = {
    CarbonblackCollector: CarbonblackCollector
}
