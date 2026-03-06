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
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;
const packageJson = require('./package.json');
const calcNextCollectionInterval = require('@alertlogic/paws-collector').calcNextCollectionInterval;
const utils = require("./utils");
const querystring = require('querystring');

let typeIdPaths = [];

let tsPaths = [];

const Events = 'Events';
const API_THROTTLING_ERROR = 429;

class CiscoampCollector extends PawsCollector {
    constructor(context, creds) {
        super(context, creds, packageJson.version);
    }

    pawsInitCollectionState(event) {
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
        return {state: initialStates, nextInvocationTimeout: 1};
    }

    pawsGetRegisterParameters(event) {
        const regValues = {
            ciscoampResourceNames: process.env.collector_streams
        };
        return regValues;
    }

    async pawsGetLogs(state) {
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
            throw new Error("The Client Secret was not found!");
        }
        const clientId = collector.clientId;
        if (!clientId) {
            throw new Error("The Client ID was not found!");
        }

        const baseUrl = process.env.paws_endpoint.replace(/^https:\/\/|\/$/g, '');
        const base64EncodedString = Buffer.from(`${clientId}:${clientSecret}`, 'ascii').toString("base64");

        if (state.stream === Events && state.totalLogsCount === 0 && state.nextPage === null) {
            //Events API first call(Date time)
            state.until = moment().toISOString();
        }

        var resourceDetails = utils.getAPIDetails(state);
        if (!resourceDetails.url) {
            throw new Error("The resource name was not found!");
        }

        typeIdPaths = resourceDetails.typeIdPaths;
        tsPaths = resourceDetails.tsPaths;

        let apiUrl = state.nextPage ? state.nextPage : resourceDetails.url;

        AlLogger.info(`CAMP000001 Collecting data for ${state.stream} from ${state.since} till ${state.until}`);
        try {
            const { accumulator, nextPage, newSince } = await utils.getAPILogs(baseUrl, base64EncodedString, apiUrl, state, [], process.env.paws_max_pages_per_invocation);
            state.apiQuotaResetDate = null;
            if (state.stream === Events && apiUrl === resourceDetails.url && newSince) {
                // Added 1 more secs in received date to avoid duplication of message
                state.until = moment(newSince).add(1, 'seconds').toISOString();
            }

            let newState;
            if (nextPage === undefined) {
                newState = this._getNextCollectionState(state);
            } else {
                newState = this._getNextCollectionStateWithNextPage(state, nextPage, accumulator.length);
            }
            AlLogger.info(`CAMP000004 Next collection in ${newState.poll_interval_sec} seconds`);
            return [accumulator, newState, newState.poll_interval_sec];
        } catch (error) {

            const errResponse = typeof error !== 'string' ? error.response : null;
            const hasApiErrors = errResponse && errResponse.data && Array.isArray(errResponse.data.errors) && errResponse.data.errors.length > 0;
            const apiErrorCode = hasApiErrors ? errResponse.data.errors[0].error_code : null;
            if (apiErrorCode === API_THROTTLING_ERROR) {
                const rateLimitResetSecs = parseInt(errResponse.headers['x-ratelimit-reset'], 10);
                const extraBufferSeconds = 60;
                const resetSeconds = Number.isNaN(rateLimitResetSecs) ? extraBufferSeconds : rateLimitResetSecs + extraBufferSeconds;
                state.apiQuotaResetDate = moment().add(resetSeconds, "seconds").toISOString();
                AlLogger.info(`CAMP000003 API hourly Limit Exceeded. The quota will be reset at ${state.apiQuotaResetDate}`);
                state.poll_interval_sec = resetSeconds;
                // Reduce time interval to half till 60 sec and try to fetch data again.
                const currentInterval = moment(state.until).diff(state.since, 'seconds');
                if (currentInterval > 120) {
                    state.until = moment(state.since).add(Math.ceil(currentInterval / 2), 'seconds').toISOString();
                }
                await collector.reportApiThrottling();
                return [[], state, state.poll_interval_sec];
            }
            else {
                // set errorCode if not available in error object to showcase client error on DDMetric 
                if (hasApiErrors) {
                    errResponse.data.errorCode = apiErrorCode;
                    throw errResponse.data;
                }
                else {
                    error.errorCode = (errResponse && errResponse.status) ? errResponse.status : error.status;
                    throw error;
                }
            }
        }
    }

    _getNextCollectionState(curState) {

        const untilMoment = moment(curState.until);

        const { nextUntilMoment, nextSinceMoment, nextPollInterval } = calcNextCollectionInterval('day-cap', untilMoment, this.pollInterval);

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
            hostname: collector.collector_id,
            messageTs: ts.sec,
            priority: 11,
            progName: 'CiscoampCollector',
            message: JSON.stringify(msg),
            messageType: 'json/ciscoamp',
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

    setStreamToCollectionState(curState) {
        return {
            stream: curState.resource,
            since: curState.since,
            until: curState.until,
            nextPage: curState.nextPage,
            apiQuotaResetDate: curState.apiQuotaResetDate,
            totalLogsCount: curState.totalLogsCount,
            poll_interval_sec: curState.poll_interval_sec
        };
    }
}

module.exports = {
    CiscoampCollector: CiscoampCollector
}
