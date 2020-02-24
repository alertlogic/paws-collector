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
const utils = require("./utils");
var jwt = require('jsonwebtoken');
var request = require('request');



const typeIdPaths = [{ path: ["attributes"] }];

let tsPaths = [];


class SalesforceCollector extends PawsCollector {
    constructor(context, creds) {
        super(context, creds, 'salesforce');
    }

    pawsInitCollectionState(event, callback) {

        const startTs = process.env.paws_collection_start_ts ?
            process.env.paws_collection_start_ts :
            moment().subtract(5, "minutes").toISOString();

        const endTs = moment(startTs).add(this.pollInterval, 'seconds').toISOString();

        const objectNames = JSON.parse(process.env.paws_collector_param_string_3);
        const initialStates = objectNames.map(object => {
            return {
                object,
                since: startTs,
                until: endTs,
                poll_interval_sec: 1
            }
        });
        return callback(null, initialStates, 1);
    }

    pawsGetRegisterParameters(event, callback) {
        const regValues = {
            salesforceUserID: process.env.paws_collector_param_string_1,
            salesforceTokenURL: process.env.paws_collector_param_string_2,
            salesforceObjectNames: process.env.paws_collector_param_string_3 
        };

        callback(null, regValues);
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

        console.info(`SALE000001 Collecting data for ${state.object} from ${state.since} till ${state.until}`);

        request({
            url: tokenUrl,
            method: 'POST',
            form: {
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion: token
            },
        }, function (err, response) {
            if (err) {
                return callback(err);
            }
            var objectQueryDetails = utils.getObjectQuery(state);
            if (!objectQueryDetails.query) {
                return callback("The object name was not found!");
            }

            tsPaths = objectQueryDetails.tsPaths;

            utils.getObjectLogs(response, objectQueryDetails.query, process.env.paws_max_pages_per_invocation)
                .then((result) => {
                    const newState = collector._getNextCollectionState(state);
                    console.info(`SALE000002 Next collection in ${newState.poll_interval_sec} seconds`);
                    return callback(null, result, newState, newState.poll_interval_sec);
                })
                .catch((error) => {
                    return callback(error);
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

        let nextUntilMoment;
        if (nowMoment.diff(nextSinceTs, 'hours') > 24) {
            console.log('collection is more than 24 hours behind. Increasing the collection time to catch up')
            nextUntilMoment = moment(nextSinceTs).add(24, 'hours');
        }
        else if (nowMoment.diff(nextSinceTs, 'hours') > 1) {
            console.log('collection is more than 1 hour behind. Increasing the collection time to catch up')
            nextUntilMoment = moment(nextSinceTs).add(1, 'hours');
        }
        else {
            nextUntilMoment = moment(nextSinceTs).add(this.pollInterval, 'seconds');
        }
        // Check if we're behind collection schedule and need to catch up.
        const nextPollInterval = nowMoment.diff(nextUntilMoment, 'seconds') > this.pollInterval ?
            1 : this.pollInterval;

        return {
            object: curState.object,
            since: nextSinceTs,
            until: nextUntilMoment.toISOString(),
            poll_interval_sec: nextPollInterval
        };
    }

    pawsFormatLog(msg) {

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
