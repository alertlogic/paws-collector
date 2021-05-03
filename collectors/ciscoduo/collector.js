/* -----------------------------------------------------------------------------
 * @copyright (C) 2020, Alert Logic, Inc
 * @doc
 *
 * ciscoduo class.
 *
 * @end
 * -----------------------------------------------------------------------------
 */
'use strict';

const moment = require('moment');
const PawsCollector = require('@alertlogic/paws-collector').PawsCollector;
const parse = require('@alertlogic/al-collector-js').Parse;
const packageJson = require('./package.json');
const duo = require('@duosecurity/duo_api');
const utils = require("./utils");
const calcNextCollectionInterval = require('@alertlogic/paws-collector').calcNextCollectionInterval;


let typeIdPaths = [];

let tsPaths = [];

const Authentication = 'Authentication';


class CiscoduoCollector extends PawsCollector {
    constructor(context, creds) {
        super(context, creds, packageJson.version);
    }

    pawsInitCollectionState(event, callback) {
        const startTs = process.env.paws_collection_start_ts ?
            process.env.paws_collection_start_ts :
            moment().toISOString();
        const endTs = moment(startTs).add(this.pollInterval, 'seconds').toISOString();
        const objectNames = JSON.parse(process.env.collector_streams);
        const initialStates = objectNames.map(stream => {
            if (stream === Authentication) {
                return {
                    stream,
                    mintime: moment(startTs).valueOf(),
                    maxtime: moment(endTs).valueOf(),
                    nextPage: null,
                    poll_interval_sec: 1
                }
            }
            else {
                return {
                    stream,
                    mintime: moment(startTs).unix(),
                    poll_interval_sec: 1
                }
            }
        });
        return callback(null, initialStates, 1);
    }

    pawsGetRegisterParameters(event, callback) {
        const regValues = {
            ciscoduoObjectNames: process.env.collector_streams
        };
        callback(null, regValues);
    }

    pawsGetLogs(state, callback) {
        let collector = this;
        // This code can remove once exsisting code set stream and collector_streams env variable
        if (!process.env.collector_streams) {
            collector.setCollectorStreamsEnv(process.env.paws_collector_param_string_1);
        }
        if (!state.stream) {
            state = collector.setStreamToCollectionState(state);
        }
        const clientSecret = collector.secret;
        if (!clientSecret) {
            return callback("The Client Secret was not found!");
        }
        const clientId = collector.clientId;
        if (!clientId) {
            return callback("The Client ID was not found!");
        }

        const hostName = collector.pawsDomainEndpoint;
        if (!clientId) {
            return callback("The Host Name was not found!");
        }

        const client = new duo.Client(clientId, clientSecret, hostName);

        var objectDetails = utils.getAPIDetails(state);
        if (!objectDetails.url) {
            return callback("The object name was not found!");
        }

        typeIdPaths = objectDetails.typeIdPaths;
        tsPaths = objectDetails.tsPaths;

        const stateMaxtime = state.maxtime ? `till ${moment(parseInt(state.maxtime)).toISOString()}` : ``;

        console.info(`CDUO000001 Collecting data for ${state.stream} from ${moment(parseInt(state.mintime)).toISOString()} ${stateMaxtime}`);

        utils.getAPILogs(client, objectDetails, state, [], process.env.paws_max_pages_per_invocation)
            .then(({ accumulator, nextPage }) => {
                let newState;
                if (nextPage === undefined) {
                    newState = this._getNextCollectionState(state);
                } else {
                    newState = this._getNextCollectionStateWithNextPage(state, nextPage);
                }
                console.info(`CDUO000002 Next collection in ${newState.poll_interval_sec} seconds`);
                return callback(null, accumulator, newState, newState.poll_interval_sec);
            }).catch((error) => {         
                // set errorCode if not available in error object to showcase client error on DDMetrics
                error.errorCode = error.code;
                return callback(error);
            });
    }

    _getNextCollectionState(curState) {

        if (curState.stream === Authentication) {

            const untilMoment = moment(parseInt(curState.maxtime));

            const { nextUntilMoment, nextSinceMoment, nextPollInterval } = calcNextCollectionInterval('no-cap', untilMoment, this.pollInterval);

            return {
                stream: curState.stream,
                mintime: nextSinceMoment.valueOf(),
                maxtime: nextUntilMoment.valueOf(),
                nextPage: null,
                poll_interval_sec: nextPollInterval
            };
        }
        else {
            // This condition works if next page getting null or undefined
            const untilMoment = moment();

            const { nextUntilMoment, nextSinceMoment, nextPollInterval } = calcNextCollectionInterval('no-cap', untilMoment, this.pollInterval);

            return {
                stream: curState.stream,
                mintime: nextSinceMoment.unix(),
                poll_interval_sec: nextPollInterval
            };

        }
    }

    _getNextCollectionStateWithNextPage(curState, nextPage) {

        if (curState.stream === Authentication) {
            return {
                stream: curState.stream,
                mintime: curState.mintime,
                maxtime: curState.maxtime,
                nextPage: nextPage,
                poll_interval_sec: 1
            };
        } else {
            //There is no next page concept for this API, So Setting up the next state mintime using the last log (Unix timestamp + 1).
            return {
                stream: curState.stream,
                mintime: nextPage,
                poll_interval_sec: 1
            };
        }
    }

    pawsFormatLog(msg) {
        let collector = this;

        const ts = parse.getMsgTs(msg, tsPaths);
        const typeId = parse.getMsgTypeId(msg, typeIdPaths);

        let formattedMsg = {
            messageTs: ts.sec,
            priority: 11,
            progName: 'CiscoduoCollector',
            message: JSON.stringify(msg),
            messageType: 'json/ciscoduo',
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
        if (curState.object === Authentication) {
            return {
                stream: curState.object,
                mintime: curState.mintime,
                maxtime: curState.maxtime,
                nextPage: curState.nextPage,
                poll_interval_sec: curState.poll_interval_sec
            };
        } else {
            return {
                stream: curState.object,
                mintime: curState.mintime,
                poll_interval_sec: curState.poll_interval_sec
            };
        }
    }
}

module.exports = {
    CiscoduoCollector: CiscoduoCollector
}
