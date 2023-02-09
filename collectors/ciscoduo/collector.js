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
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;
const packageJson = require('./package.json');
const duo = require('@duosecurity/duo_api');
const utils = require("./utils");
const calcNextCollectionInterval = require('@alertlogic/paws-collector').calcNextCollectionInterval;


let typeIdPaths = [];

let tsPaths = [];

const Authentication = 'Authentication';
const API_THROTTLING_ERROR = 42901;
const MAX_POLL_INTERVAL = 900;
const POLL_INTERVAL_SECS = 60;

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
        const pollInterval = objectNames.length * POLL_INTERVAL_SECS;
        const initialStates = objectNames.map(stream => {
            if (stream === Authentication) {
                return {
                    stream,
                    since: moment(startTs).valueOf(),
                    until: moment(endTs).valueOf(),
                    nextPage: null,
                    poll_interval_sec: pollInterval
                }
            }
            else {
                return {
                    stream,
                    since: moment(startTs).unix(),
                    poll_interval_sec: pollInterval
                }
            }
        });
        return callback(null, initialStates, pollInterval);
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
        if (!state.since) {
            state = collector.setSinceUntilToCollectionState(state);
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
        const stateUntil = state.until ? `till ${moment(parseInt(state.until)).toISOString()}` : ``;
        const stateSince = state.stream === Authentication ? moment(parseInt(state.since)).toISOString() : moment(parseInt(state.since * 1000)).toISOString(); // Convert Epoch timestamp to milliseconds to get date in correct format

        AlLogger.info(`CDUO000001 Collecting data for ${state.stream} from ${stateSince} ${stateUntil}`);

        utils.getAPILogs(client, objectDetails, state, [], process.env.paws_max_pages_per_invocation)
            .then(({ accumulator, nextPage }) => {
                let newState;
                if (nextPage === undefined) {
                    newState = this._getNextCollectionState(state);
                } else {
                    newState = this._getNextCollectionStateWithNextPage(state, nextPage);
                }
                AlLogger.info(`CDUO000002 Next collection in ${newState.poll_interval_sec} seconds`);
                return callback(null, accumulator, newState, newState.poll_interval_sec);
            }).catch((error) => {
                // Cisco duo api has some rate limits that we might run into.
                // If we run into a rate limit error, instead of returning the error,
                // We return the state back to the queue with an additional 60 secs.
                if (error.code && error.code === API_THROTTLING_ERROR) {
                    state.poll_interval_sec = state.poll_interval_sec < MAX_POLL_INTERVAL ?
                    state.poll_interval_sec + POLL_INTERVAL_SECS : MAX_POLL_INTERVAL;
                    AlLogger.warn(`CDUO000003 API Request Limit Exceeded`, error);
                    collector.reportApiThrottling(function () {
                        return callback(null, [], state, state.poll_interval_sec);
                    });
                }
                else {
                    // set errorCode if not available in error object to showcase client error on DDMetrics
                    error.errorCode = error.code;
                    return callback(error);
                }
            });
    }

    _getNextCollectionState(curState) {

        if (curState.stream === Authentication) {

            const untilMoment = moment(parseInt(curState.until));
             // Used hour-cap instead of making api call for 1 min interval, may help to reduce throtling issue.
            const { nextUntilMoment, nextSinceMoment, nextPollInterval } = calcNextCollectionInterval('hour-cap', untilMoment, this.pollInterval);
            const nextPollIntervalSec = nextPollInterval >= POLL_INTERVAL_SECS ? nextPollInterval : POLL_INTERVAL_SECS * JSON.parse(process.env.collector_streams).length;
            return {
                stream: curState.stream,
                since: nextSinceMoment.valueOf(),
                until: nextUntilMoment.valueOf(),
                nextPage: null,
                poll_interval_sec: nextPollIntervalSec
            };
        }
        else {
            // This condition works if next page getting null or undefined
            const untilMoment = moment();
            if (curState.since) {
                // New since is either last hour or current.since if it is less than one hr.
                // Set nextPoll interval to 15 min as it collecting data for last one hr
                const nextUntilMoment = moment().subtract(1, 'hours').unix();
                const newSince = Math.max(parseInt(curState.since) + 1, nextUntilMoment);
                return {
                    stream: curState.stream,
                    since: newSince,
                    poll_interval_sec: MAX_POLL_INTERVAL
                };
            }
            else {
                let { nextUntilMoment, nextSinceMoment, nextPollInterval } = calcNextCollectionInterval('no-cap', untilMoment, this.pollInterval);
                return {
                    stream: curState.stream,
                    since: nextSinceMoment.unix(),
                    poll_interval_sec: nextPollInterval
                };
            }
        }
    }

    _getNextCollectionStateWithNextPage(curState, nextPage) {

        if (curState.stream === Authentication) {
            return {
                stream: curState.stream,
                since: curState.since,
                until: curState.until,
                nextPage: nextPage,
                poll_interval_sec: 60
            };
        } else {
            //There is no next page concept for this API, So Setting up the next state since using the last log (Unix timestamp + 1).
            // call after 60 sec to avoid multiple api call
            return {
                stream: curState.stream,
                since: nextPage,
                poll_interval_sec: 60
            };
        }
    }

    pawsFormatLog(msg) {
        let collector = this;

        const ts = parse.getMsgTs(msg, tsPaths);
        const typeId = parse.getMsgTypeId(msg, typeIdPaths);

        let formattedMsg = {
            hostname: collector.collector_id,
            messageTs: ts.sec,
            priority: 11,
            progName: 'CiscoduoCollector',
            message: JSON.stringify(msg),
            messageType: 'json/ciscoduo',
            applicationId: collector.application_id
        };

        if (typeId !== null && typeId !== undefined) {
            formattedMsg.messageTypeId = `${typeId}`;
        }
        if (ts.usec) {
            formattedMsg.messageTsUs = ts.usec;
        }
        return formattedMsg;
    }

    setSinceUntilToCollectionState(curState) {
        if (curState.stream === Authentication) {
            return {
                stream: curState.stream,
                since: curState.mintime,
                until: curState.maxtime,
                nextPage: curState.nextPage,
                poll_interval_sec: curState.poll_interval_sec
            };
        } else {
            return {
                stream: curState.stream,
                since: curState.mintime,
                poll_interval_sec: curState.poll_interval_sec
            };
        }
    }
}

module.exports = {
    CiscoduoCollector: CiscoduoCollector
}
