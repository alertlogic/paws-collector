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


const typeIdPaths = [
    { path: ['type'] }
];

const tsPaths = [
    { path: ['date'] }
];

const HOSTNAME_REGEXP = /^[https]*:\/\/|\/$/g;


class Auth0Collector extends PawsCollector {

    pawsInitCollectionState(event, callback) {
        const initialState = {
            since: process.env.paws_collection_start_ts ? process.env.paws_collection_start_ts : moment().subtract(5, 'minutes').toISOString(),
            poll_interval_sec: 1
        };
        return callback(null, initialState, 1);
    }

    pawsGetLogs(state, callback) {
        let collector = this;
        const hostname = process.env.paws_endpoint.replace(HOSTNAME_REGEXP, '');
        const auth0Client = new ManagementClient({
            domain: hostname,
            clientId: collector.clientId,
            clientSecret: collector.secret,
            scope: 'read:logs'
        });
        let params = state.last_log_id ? {from: state.last_log_id} : {q: "date=[" + state.since + " TO *]", sort: "date:1"};
        const collection = auth0Client.getLogs(params);
        let logAcc = [];
        collection.each(log => {
            logAcc.push(log);
        })
        .then(() => {
            const nextLogId = (logAcc.length > 0) ? logAcc[logAcc.length-1].log_id : state.last_log_id;
            const lastLogTs = (logAcc.length > 0) ? logAcc[logAcc.length-1].date : null;
            const newState = collector._getNextCollectionState(state, nextLogId, lastLogTs);
            console.info(`AUTZ000002 Next collection in ${newState.poll_interval_sec} seconds`);
            return callback(null, logAcc, newState, newState.poll_interval_sec);
        })
        .catch((error) => {
            return callback(error);
        });
    }

    _getNextCollectionState(curState, nextLogId, lastLogTs) {
        const nowMoment = moment();
        const lastLogMoment = moment(lastLogTs);

        // Check if we're behind collection schedule and need to catch up.
        const nextPollInterval = nowMoment.diff(lastLogMoment, 'seconds') > this.pollInterval ?
                1 : this.pollInterval;

        return  {
            last_log_id: nextLogId,
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
