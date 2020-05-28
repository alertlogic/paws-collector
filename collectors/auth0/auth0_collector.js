/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * Auth0 collector class.
 *
 * @end
 * -----------------------------------------------------------------------------
 */
'use strict';

const moment = require('moment');
const request = require('request');
const parse = require('@alertlogic/al-collector-js').Parse;
const ManagementClient = require('auth0').ManagementClient;
const PawsCollector = require('@alertlogic/paws-collector').PawsCollector;
const packageJson = require('./package.json');
const utils = require("./utils");

const typeIdPaths = [
    { path: ['type'] }
];

const tsPaths = [
    { path: ['date'] }
];

const HOSTNAME_REGEXP = /^[htps]*:\/\/|\/$/gi;


class Auth0Collector extends PawsCollector {

    constructor(context, creds) {
        super(context, creds, packageJson.version);
    }
    
    pawsInitCollectionState(event, callback) {
        const initialState = {
            since: process.env.paws_collection_start_ts ? process.env.paws_collection_start_ts : moment().subtract(5, 'minutes').toISOString(),
            poll_interval_sec: 1
        };
        return callback(null, initialState, 1);
    }

    pawsGetLogs(state, callback) {
        let collector = this;
        const hostname = collector.pawsDomainEndpoint;
        const auth0Client = new ManagementClient({
            domain: hostname,
            clientId: collector.clientId,
            clientSecret: collector.secret,
            scope: 'read:logs'
        });
        utils.getAPILogs(auth0Client, state, [], process.env.paws_max_pages_per_invocation)
            .then(({ accumulator, nextLogId, lastLogTs }) => {
                const newState = collector._getNextCollectionState(state, nextLogId, lastLogTs);
                console.info(`AUTZ000002 Next collection in ${newState.poll_interval_sec} seconds`);
                return callback(null, accumulator, newState, newState.poll_interval_sec);
            }).catch((error) => {
                return callback(error);
            });
    }

    _getNextCollectionState(curState, nextLogId, lastLogTs) {
        const nowMoment = moment();
        const lastLogMoment = moment(lastLogTs);

        // Check if we're behind collection schedule and need to catch up.
        const nextPollInterval = nowMoment.diff(lastLogMoment, 'seconds') > this.pollInterval ?
                1 : this.pollInterval;

        if (nextLogId === null) {
            //If collector initial call and get empty logs then this condition will work
            return {
                since: curState.since,
                poll_interval_sec: 1
            };
        }

        return {
            last_log_id: nextLogId,
            last_collected_ts: lastLogTs,
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
            progName: 'Auth0Collector',
            message: JSON.stringify(msg),
            messageType: 'json/auth0',
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
    Auth0Collector: Auth0Collector
}
