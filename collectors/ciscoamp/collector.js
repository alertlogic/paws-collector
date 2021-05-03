/* -----------------------------------------------------------------------------
 * @copyright (C) 2020, Alert Logic, Inc
 * @doc
 *
 * ciscoamp class.
 *
 * @end
 * -----------------------------------------------------------------------------
 */
'use strict';

const moment = require('moment');
const PawsCollector = require('@alertlogic/paws-collector').PawsCollector;
const parse = require('@alertlogic/al-collector-js').Parse;
const packageJson = require('./package.json');
const calcNextCollectionInterval = require('@alertlogic/paws-collector').calcNextCollectionInterval;
const utils = require("./utils");
const querystring = require('querystring');

let typeIdPaths = [];

let tsPaths = [];

const Events = 'Events';

class CiscoampCollector extends PawsCollector {
    constructor(context, creds) {
        super(context, creds, packageJson.version);
    }

    pawsInitCollectionState(event, callback) {
        const startTs = process.env.paws_collection_start_ts ?
            process.env.paws_collection_start_ts :
            moment().toISOString();
        const endTs = moment(startTs).add(this.pollInterval, 'seconds').toISOString();

        const resourceNames = JSON.parse(process.env.collector_streams);
        const initialStates = resourceNames.map(stream => ({
            stream,
            since: startTs,
            until: endTs,
            nextPage: null,
            apiQuotaResetDate: null,
            totalLogsCount: 0,
            poll_interval_sec: 1
        }));
        return callback(null, initialStates, 1);
    }

    pawsGetRegisterParameters(event, callback) {
        const regValues = {
            ciscoampResourceNames: process.env.collector_streams
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

        const baseUrl = process.env.paws_endpoint.replace(/^https:\/\/|\/$/g, '');
        const base64EncodedString = Buffer.from(`${clientId}:${clientSecret}`, 'ascii').toString("base64");

        if (state.stream === Events && state.totalLogsCount === 0 && state.nextPage === null) {
            //Events API first call(Date time)
            state.until = moment().toISOString();
        }

        var resourceDetails = utils.getAPIDetails(state);
        if (!resourceDetails.url) {
            return callback("The resource name was not found!");
        }

        typeIdPaths = resourceDetails.typeIdPaths;
        tsPaths = resourceDetails.tsPaths;

        let apiUrl = state.nextPage ? state.nextPage : resourceDetails.url;

        console.info(`CAMP000001 Collecting data for ${state.stream} from ${state.since} till ${state.until}`);

        if (state.apiQuotaResetDate && moment().isBefore(state.apiQuotaResetDate)) {
            console.log('CAMP000002 API hourly Limit Exceeded. The quota will be reset at ', state.apiQuotaResetDate);
            state.poll_interval_sec = 900;
            collector.reportApiThrottling(function () {
                return callback(null, [], state, state.poll_interval_sec);
            });
        }
        else {

        utils.getAPILogs(baseUrl, base64EncodedString, apiUrl, state, [], process.env.paws_max_pages_per_invocation)
            .then(({ accumulator, nextPage, resetSeconds, totalLogsCount, discardFlag }) => {
                if (resetSeconds) {
                    const extraBufferSeconds = 60;
                    resetSeconds = resetSeconds + extraBufferSeconds;
                    state.apiQuotaResetDate = moment().add(resetSeconds, "seconds").toISOString();
                    console.log('CAMP000003 API hourly Limit Exceeded. The quota will be reset at ', state.apiQuotaResetDate);
                }
                else {
                    state.apiQuotaResetDate = null;
                }
                if (discardFlag && state.stream === Events) {

                    if (state.totalLogsCount === 0) {
                        return callback(null, accumulator, state, state.poll_interval_sec);
                    }
                    const searchParams = querystring.parse(state.nextPage);
                    let offset = searchParams.offset;

                    offset = (parseInt(totalLogsCount) - parseInt(state.totalLogsCount)) + parseInt(offset);
                    searchParams.offset = offset;

                    let newOffsetURL = "";
                    Object.entries(searchParams).forEach(([key, value]) => {
                        newOffsetURL = newOffsetURL + (newOffsetURL === "" ? `${key}=${value}` : `&${key}=${value}`);
                    });

                    state.totalLogsCount = totalLogsCount;
                    state.nextPage = newOffsetURL;

                    return callback(null, accumulator, state, state.poll_interval_sec);
                }
                let newState;
                if (nextPage === undefined) {
                    newState = this._getNextCollectionState(state);
                } else {
                    newState = this._getNextCollectionStateWithNextPage(state, nextPage, totalLogsCount);
                }
                console.info(`CAMP000004 Next collection in ${newState.poll_interval_sec} seconds`);
                return callback(null, accumulator, newState, newState.poll_interval_sec);
            }).catch((error) => {
                // set errorCode if not available in error object to showcase client error on DDMetric
                error.errorCode = error.statusCode;
                return callback(error);
            });
        }
    }

    _getNextCollectionState(curState) {

        const untilMoment = moment(curState.until);

        const { nextUntilMoment, nextSinceMoment, nextPollInterval } = calcNextCollectionInterval('no-cap', untilMoment, this.pollInterval);

        return {
            stream: curState.stream,
            since: nextSinceMoment.toISOString(),
            until: nextUntilMoment.toISOString(),
            nextPage: null,
            apiQuotaResetDate: curState.apiQuotaResetDate,
            totalLogsCount: 0,
            poll_interval_sec: nextPollInterval
        };
    }

    _getNextCollectionStateWithNextPage({ stream, since, until, apiQuotaResetDate }, nextPage, totalLogsCount) {
        return {
            stream,
            since,
            until,
            nextPage,
            apiQuotaResetDate,
            totalLogsCount,
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
            progName: 'CiscoampCollector',
            message: JSON.stringify(msg),
            messageType: 'json/ciscoamp',
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
            stream: curState.resource,
            since: curState.since,
            until: curState.until,
            nextPage: curState.nextPage,
            apiQuotaResetDate:curState.apiQuotaResetDate,
            totalLogsCount: curState.totalLogsCount,
            poll_interval_sec: curState.poll_interval_sec
        };
    }
}

module.exports = {
    CiscoampCollector: CiscoampCollector
}
