/* -----------------------------------------------------------------------------
 * @copyright (C) 2020, Alert Logic, Inc
 * @doc
 *
 * sentinelone class.
 *
 * @end
 * -----------------------------------------------------------------------------
 */
'use strict';

const moment = require('moment');
const PawsCollector = require('@alertlogic/paws-collector').PawsCollector;
const parse = require('@alertlogic/al-collector-js').Parse;
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;
const utils = require("./utils");
const calcNextCollectionInterval = require('@alertlogic/paws-collector').calcNextCollectionInterval;
const packageJson = require('./package.json');

const typeIdPaths = [{ path: ['id'] }];

const tsPaths = [{ path: ['createdAt'] }];

class SentineloneCollector extends PawsCollector {
    constructor(context, creds) {
        super(context, creds, packageJson.version);
    }

    async pawsInitCollectionState(event) {
        const startTs = process.env.paws_collection_start_ts ?
            process.env.paws_collection_start_ts :
            moment().toISOString();
        const endTs = moment(startTs).add(this.pollInterval, 'seconds').toISOString();
        const initialState = {
            since: startTs,
            until: endTs,
            nextPage: null,
            poll_interval_sec: 1
        };
        return { state: initialState, nextInvocationTimeout: 1 };
    }

    async pawsGetLogs(state) {
        let collector = this;
        const clientSecret = collector.secret;
        if (!clientSecret) {
            throw new Error("The Client Secret was not found!");
        }

        const baseUrl = process.env.paws_endpoint.replace(/^https:\/\/|\/$/g, '');

        AlLogger.info(`SONE000001 Collecting data from ${state.since} till ${state.until}`);

        let params = state.nextPage ? {
            cursor: state.nextPage
        } : {};

        Object.assign(params, {
            createdAt__gte: state.since,
            createdAt__lt: state.until,
            limit: 100
        });

        try {
            const { accumulator, nextPage } = await utils.getAPILogs(baseUrl, clientSecret, params, [], process.env.paws_max_pages_per_invocation);
            let newState;
            if (nextPage === undefined) {
                newState = this._getNextCollectionState(state);
            } else {
                newState = this._getNextCollectionStateWithNextPage(state, nextPage);
            }
            AlLogger.info(`SONE000002 Next collection in ${newState.poll_interval_sec} seconds`);
            return [accumulator, newState, newState.poll_interval_sec];
        } catch (error) {
            this._throwNormalizedClientError(error);
        }
    }

    _throwNormalizedClientError(error) {
        // set the errorCode for client DD metrics
        if (error && error.response && error.response.data && typeof error.response.data === 'object') {
            const responseErrors = error.response.data.errors;
            const responseError = Array.isArray(responseErrors) ? responseErrors[0] : undefined;
            if (!error.response.data.errorCode) {
                error.response.data.errorCode = responseError && responseError.code ?
                    responseError.code :
                    error.response.status ||
                    'CLIENT_ERROR';
            }
            throw error.response.data;
        }
        if (error && error.response) {
            error.errorCode = error.errorCode || error.response.status || 'CLIENT_ERROR';
        }
        throw error;
    }

    _getNextCollectionState(curState) {

        const untilMoment = moment(curState.until);

        const { nextUntilMoment, nextSinceMoment, nextPollInterval } = calcNextCollectionInterval('hour-day-progression', untilMoment, this.pollInterval);

        return {
            since: nextSinceMoment.toISOString(),
            until: nextUntilMoment.toISOString(),
            nextPage: null,
            poll_interval_sec: nextPollInterval
        };
    }

    _getNextCollectionStateWithNextPage({ since, until }, nextPage) {
        return {
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
            hostname: collector.collector_id,
            messageTs: ts.sec,
            priority: 11,
            progName: 'SentineloneCollector',
            message: JSON.stringify(msg),
            messageType: 'json/sentinelone',
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
}

module.exports = {
    SentineloneCollector: SentineloneCollector
};
