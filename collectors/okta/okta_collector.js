/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * Okta collector class.
 *
 * @end
 * -----------------------------------------------------------------------------
 */
'use strict';

const moment = require('moment');
const okta = require('@okta/okta-sdk-nodejs');
const parse = require('@alertlogic/al-collector-js').Parse;
const PawsCollector = require('@alertlogic/paws-collector').PawsCollector;
const calcNextCollectionInterval = require('@alertlogic/paws-collector').calcNextCollectionInterval;

const packageJson = require('./package.json');

const THROTTLING_ERROR_REGEXP = /rateLimit/g;

const typeIdPaths = [
    { path: ['eventType'] },
    { path: ['legacyEventType'] }
];

const tsPaths = [
    { path: ['published'] }
];

const sensitiveFields = [
    "client.apiToken",
    "client.http.defaultHeaders.Authorization"
];

class OktaCollector extends PawsCollector {

    constructor(context, creds){
        super(context,
            creds, packageJson.version);
    }
    
    pawsInitCollectionState(event, callback) {
        const startTs = process.env.paws_collection_start_ts ?
                process.env.paws_collection_start_ts :
                    moment().toISOString();
        const initialState = this._getNextCollectionState({
            since: startTs,
            until: startTs,
            poll_interval_sec: 1
        });
        return callback(null, initialState, initialState.poll_interval_sec);
    }

    pawsGetLogs(state, callback) {
        let collector = this;
        const oktaClient = new okta.Client({
            orgUrl: collector.pawsHttpsEndpoint,
            token: collector.secret
        });
        console.info(`OKTA000001 Collecting data from ${state.since} till ${state.until}`);
        const collection = oktaClient.getLogs({
            since: state.since,
            until: state.until
        });
        let logAcc = [];
        collection.each(log => {
            logAcc.push(log);
        })
        .then(() => {
            const newState = collector._getNextCollectionState(state);
            console.info(`OKTA000002 Next collection in ${newState.poll_interval_sec} seconds`);
            return callback(null, logAcc, newState, newState.poll_interval_sec);
        })
        .catch((error) => {
            if (this._isThrottlingError(error)) {
                collector.reportApiThrottling(function() {
                    return callback(error);
                });
            } else {
                return callback(error);
            }
        });
    }

    _isThrottlingError(error) {
        return (error.status === 429) ||
             (error.message && error.message.match(THROTTLING_ERROR_REGEXP));
    }

    _getNextCollectionState(curState) {
        const untilMoment = moment(curState.until);

        const { nextUntilMoment, nextSinceMoment, nextPollInterval } = calcNextCollectionInterval('no-cap', untilMoment, this.pollInterval);

        return  {
             since: nextSinceMoment.toISOString(),
             until: nextUntilMoment.toISOString(),
             poll_interval_sec: nextPollInterval
        };
    }

    pawsFormatLog(msg) {
        let collector = this;

        const ts = parse.getMsgTs(msg, tsPaths);
        const typeId = parse.getMsgTypeId(msg, typeIdPaths);

        // TODO remove this when okta updates api
        sensitiveFields.forEach((path) => this.redactValue(path, msg));

        let formattedMsg = {
            messageTs: ts.sec,
            priority: 11,
            progName: 'OktaCollector',
            message: JSON.stringify(msg),
            messageType: 'json/okta',
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

    redactValue(propertyPath, obj) {
        let properties = Array.isArray(propertyPath) ? propertyPath : propertyPath.split(".")

        if (properties.length > 1) {
            if (!obj.hasOwnProperty(properties[0]))
                return
            return this.redactValue(properties.slice(1), obj[properties[0]])
        } else {
            obj[properties[0]] = undefined
        }
    }
}

module.exports = {
    OktaCollector: OktaCollector
}
