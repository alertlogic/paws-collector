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
const utils = require("./utils");
const calcNextCollectionInterval = require('@alertlogic/paws-collector').calcNextCollectionInterval;


const typeIdPaths = [{ path: ['id'] }];

const tsPaths = [{ path: ['createdAt'] }];


class SentineloneCollector extends PawsCollector {
    constructor(context, creds) {
        super(context, creds, 'sentinelone');
    }

    pawsInitCollectionState(event, callback) {
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
        return callback(null, initialState, 1);
    }

    pawsGetLogs(state, callback) {
        let collector = this;
        const clientSecret = collector.secret;
        if (!clientSecret) {
            return callback("The Client Secret was not found!");
        }

        const clientId = collector.clientId;
        if (!clientId) {
            return callback("The Client ID was not found!");
        }

        const baseUrl = process.env.paws_endpoint.replace(/^https:\/\/|\/$/g, '');
        const tokenUrl = `/web/api/v2.0/users/login`;

        console.info(`SONE000001 Collecting data from ${state.since} till ${state.until}`);

        let params = state.nextPage ? {
            cursor: state.nextPage
        } : {};

        Object.assign(params, {
            createdAt__gte: state.since,
            createdAt__lt: state.until,
            limit: 10
        });

        utils.authentication(baseUrl, tokenUrl, clientId, clientSecret)
            .then((token) => {
                utils.getAPILogs(baseUrl, token, params, [], process.env.paws_max_pages_per_invocation)
                    .then(({ accumulator, nextPage }) => {
                        let newState;
                        if (nextPage === undefined) {
                            newState = this._getNextCollectionState(state);
                        } else {
                            newState = this._getNextCollectionStateWithNextPage(state, nextPage);
                        }
                        console.info(`SONE000002 Next collection in ${newState.poll_interval_sec} seconds`);
                        return callback(null, [], newState, newState.poll_interval_sec);
                    }).catch((error) => {
                        return callback(error);
                    });
            })
            .catch((error) => {
                return callback(error);
            });
    }

    _getNextCollectionState(curState) {

        const untilMoment = moment(curState.until);

        const { nextUntilMoment, nextSinceMoment, nextPollInterval } = calcNextCollectionInterval('no-cap', untilMoment, this.pollInterval);

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
            messageTs: ts.sec,
            priority: 11,
            progName: 'SentineloneCollector',
            message: JSON.stringify(msg),
            messageType: 'json/sentinelone',
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
    SentineloneCollector: SentineloneCollector
}
