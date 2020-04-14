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

const typeIdPaths = [
    // enter your type paths in the form { path: ['myKey'] }
];

const tsPaths = [
    // enter your timestamp paths in the form { path: ['myKey'] }
];


class CiscoampCollector extends PawsCollector {
    constructor(context, creds) {
        super(context, creds, packageJson.version);
    }

    pawsInitCollectionState(event, callback) {
        const startTs = process.env.paws_collection_start_ts ?
            process.env.paws_collection_start_ts :
            moment().toISOString();
        const endTs = moment(startTs).add(this.pollInterval, 'seconds').toISOString();

        const resourceNames = JSON.parse(process.env.paws_collector_param_string_1);
        const initialStates = resourceNames.map(resource => ({
            resource,
            since: startTs,
            until: endTs,
            poll_interval_sec: 1
        }));
        return callback(null, initialStates, 1);
    }

    pawsGetRegisterParameters(event, callback) {
        const regValues = {
            ciscoampResources: process.env.paws_collector_param_string_1
        };

        callback(null, regValues);
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
        const base64EncodedString = Buffer.from(`${clientId}:${clientSecret}`, 'ascii').toString("base64");

        var resourceDetails = utils.getAPIDetails(state);
        if (!resourceDetails.url) {
            return callback("The resource name was not found!");
        }


        console.info(`CAMP000001 Collecting data from ${state.since} till ${state.until}`);
        const newState = collector._getNextCollectionState(state);
        console.info(`CAMP000002 Next collection in ${newState.poll_interval_sec} seconds`);
        return callback(null, [], newState, newState.poll_interval_sec);
    }

    _getNextCollectionState(curState) {

        const untilMoment = moment(curState.until);

        const { nextUntilMoment, nextSinceMoment, nextPollInterval } = calcNextCollectionInterval('no-cap', untilMoment, this.pollInterval);

        return {
            resource: curState.resource,
            since: nextSinceMoment.toISOString(),
            until: nextUntilMoment.toISOString(),
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
}

module.exports = {
    CiscoampCollector: CiscoampCollector
}
