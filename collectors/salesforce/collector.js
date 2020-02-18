/* -----------------------------------------------------------------------------
 * @copyright (C) 2020, Alert Logic, Inc
 * @doc
 *
 * salesforce class.
 *
 * @end
 * -----------------------------------------------------------------------------
 */
'use strict';

const moment = require('moment');
const PawsCollector = require('@alertlogic/paws-collector').PawsCollector;
const parse = require('@alertlogic/al-collector-js').Parse;
var jsforce = require('jsforce');
var jwt = require('jsonwebtoken');
var request = require('request');


const typeIdPaths = [{ path: ["attributes"] }];

const tsPaths = [{ path: ["LastLoginDate"] }];


class SalesforceCollector extends PawsCollector {
    constructor(context, creds) {
        super(context, creds, 'salesforce');
    }

    pawsInitCollectionState(event, callback) {
        const startTs = process.env.paws_collection_start_ts ?
            process.env.paws_collection_start_ts :
            moment().subtract(5, "minutes").toISOString();
        const endTs = moment(startTs).add(this.pollInterval, 'seconds').toISOString();
        const initialState = {
            since: startTs,
            until: endTs,
            poll_interval_sec: 1
        };
        return callback(null, initialState, 1);
    }

    pawsGetLogs(state, callback) {
        let collector = this;
        const privateKey = collector.secret;
        if (!privateKey) {
            throw new Error("The privateKey was not found!");
        }
        const clientId = collector.clientId;
        const salesForceUser = process.env.paws_collector_param_string_1;
        const baseUrl = process.env.paws_endpoint;
        const tokenUrl = process.env.paws_collector_param_string_2;


        var claim = {
            iss: clientId,
            aud: baseUrl,
            sub: salesForceUser,
            exp: Math.floor(Date.now() / 1000) + 3 * 60
        };

        var token = jwt.sign(claim, privateKey, { algorithm: 'RS256' });

        request({
            url: tokenUrl,
            method: 'POST',
            form: {
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion: token
            },
        }, function (err, response, body) {
            if (err) {
                return callback(err);
            }
            var ret = JSON.parse(response.body)
            var conn = new jsforce.Connection({
                accessToken: ret.access_token,
                instanceUrl: ret.instance_url
            });
            let query = `SELECT Id, Name, LastLoginDate FROM User WHERE LastLoginDate > ${state.since} AND LastLoginDate < ${state.until}`
            conn.query(query, function (err, result) {
                if (err) { return callback(err); }
                console.info(`SALE000001 Collecting data from ${state.since} till ${state.until}`);
                const newState = collector._getNextCollectionState(state);
                console.info(`SALE000002 Next collection in ${newState.poll_interval_sec} seconds`);
                return callback(null, result.records, newState, newState.poll_interval_sec);
            });
        });
    }

    _getNextCollectionState(curState) {
        const nowMoment = moment();
        const curUntilMoment = moment(curState.until);

        // Check if current 'until' is in the future.
        const nextSinceTs = curUntilMoment.isAfter(nowMoment) ?
            nowMoment.toISOString() :
            curState.until;

        const nextUntilMoment = moment(nextSinceTs).add(this.pollInterval, 'seconds');
        // Check if we're behind collection schedule and need to catch up.
        const nextPollInterval = nowMoment.diff(nextUntilMoment, 'seconds') > this.pollInterval ?
            1 : this.pollInterval;

        return {
            // TODO: define the next collection state.
            // This needs to be in the smae format as the intial colletion state above
            since: nextSinceTs,
            until: nextUntilMoment.toISOString(),
            poll_interval_sec: nextPollInterval
        };
    }

    pawsFormatLog(msg) {
        // TODO: double check that this message parsing fits your use case
        const ts = parse.getMsgTs(msg, tsPaths);
        const typeId = parse.getMsgTypeId(msg, typeIdPaths);

        let formattedMsg = {
            messageTs: ts.sec,
            priority: 11,
            progName: 'SalesforceCollector',
            message: JSON.stringify(msg),
            messageType: 'json/salesforce'
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
    SalesforceCollector: SalesforceCollector
}
