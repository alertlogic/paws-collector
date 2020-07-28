/* -----------------------------------------------------------------------------
 * @copyright (C) 2020, Alert Logic, Inc
 * @doc
 *
 * sophossiem class.
 *
 * @end
 * -----------------------------------------------------------------------------
 */
'use strict';

const moment = require('moment');
const PawsCollector = require('@alertlogic/paws-collector').PawsCollector;
const parse = require('@alertlogic/al-collector-js').Parse;
const packageJson = require('./package.json');
const utils = require("./utils");


const typeIdPaths = [{ path: ['id'] }];

const tsPaths = [{ path: ['created_at'] }];


class SophossiemCollector extends PawsCollector {
    constructor(context, creds) {
        super(context, creds, packageJson.version);
    }

    pawsInitCollectionState(event, callback) {
        const startTs = process.env.paws_collection_start_ts ?
            process.env.paws_collection_start_ts :
            moment().toISOString();

        //From date must be within last 24 hours
        let from_date_unix;
        if (moment().diff(startTs, 'hours') < 24) {
            from_date_unix = moment(startTs).unix();
        }
        else {
            from_date_unix = moment().subtract(23, 'hours').unix();
        }

        const objectNames = JSON.parse(process.env.paws_collector_param_string_1);
        const initialStates = objectNames.map(objectName => {
            return {
                objectName,
                from_date: from_date_unix,
                poll_interval_sec: 1
            }
        });

        return callback(null, initialStates, 1);
    }

    pawsGetRegisterParameters(event, callback) {
        const regValues = {
            sophossiemObjectNames: process.env.paws_collector_param_string_1
        };
        callback(null, regValues);
    }

    pawsGetLogs(state, callback) {
        let collector = this;

        const clientSecret = collector.secret;
        if (!clientSecret) {
            return callback("The Authorization token was not found!");
        }

        const x_api_key = collector.clientId;
        if (!x_api_key) {
            return callback("The x-api-key was not found!");
        }

        const headers = {
            "x-api-key": x_api_key,
            "Authorization": clientSecret
        };

        const APIHostName = collector.pawsDomainEndpoint;
        if (!APIHostName) {
            return callback("The Host Name was not found!");
        }

        console.info(`SIEM000001 Collecting data for ${state.objectName}`);

        utils.getAPILogs(APIHostName, headers, state, [], process.env.paws_max_pages_per_invocation)
            .then(({ accumulator, nextPage, has_more }) => {
                const newState = collector._getNextCollectionState(state, nextPage, has_more);
                console.info(`SIEM000002 Next collection in ${newState.poll_interval_sec} seconds`);
                return callback(null, accumulator, newState, newState.poll_interval_sec);
            }).catch((error) => {
                return callback(error);
            });
    }

    _getNextCollectionState(curState, nextPage, has_more) {
        let nextPollInterval;

        if (has_more) {
            nextPollInterval = 1;
        }
        else {
            nextPollInterval = this.pollInterval;
        }

        return {
            objectName: curState.objectName,
            nextPage: nextPage,
            poll_interval_sec: nextPollInterval
        };
    }

    pawsFormatLog(msg) {
        let collector = this;

        const ts = parse.getMsgTs(msg, tsPaths);
        const typeId = parse.getMsgTypeId(msg, typeIdPaths);

        let formattedMsg = {
            messageTs: ts.sec,
            priority: 11,
            progName: 'SophossiemCollector',
            message: JSON.stringify(msg),
            messageType: 'json/sophossiem',
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
    SophossiemCollector: SophossiemCollector
}
