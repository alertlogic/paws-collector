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
const RestServiceClient = require('@alertlogic/al-collector-js').RestServiceClient;
const packageJson = require('./package.json');


const typeIdPaths = [{ path: ["attributes"] }];

let tsPaths = [];


class SalesforceCollector extends PawsCollector {
    constructor(context, creds) {
        super(context, creds, packageJson.version);
    }

    pawsInitCollectionState(event, callback) {

        const startTs = process.env.paws_collection_start_ts ?
            process.env.paws_collection_start_ts :
            moment().subtract(5, "minutes").toISOString();

        const endTs = moment(startTs).add(this.pollInterval, 'seconds').toISOString();

        const objectNames = JSON.parse(process.env.collector_streams);
        const initialStates = objectNames.map(stream => {
            return {
                stream,
                since: startTs,
                until: endTs,
                nextPage: null,
                apiQuotaResetDate: null,
                poll_interval_sec: 1
            }
        });
        return callback(null, initialStates, 1);
    }

    pawsGetRegisterParameters(event, callback) {
        const regValues = {
            salesforceUserID: process.env.paws_collector_param_string_1,
            salesforceObjectNames: process.env.collector_streams
        };

        callback(null, regValues);
    }

    pawsGetLogs(state, callback) {
        let collector = this;
        // This code can remove once exsisting code set stream and collector_streams env variable
        if (!process.env.collector_streams) {
            collector.setCollectorStreamsEnv(process.env.paws_collector_param_string_2);
        }
        if (!state.stream) {
            state = collector.setStreamToCollectionState(state);
        }
          
        const privateKey = collector.secret;
        if (!privateKey) {
            throw new Error("The private key was not found!");
        }
        const clientId = collector.clientId;
        const salesForceUser = process.env.paws_collector_param_string_1;
        const baseUrl = process.env.paws_endpoint.replace(/^https:\/\/|\/$/g, '');
        const tokenUrl = `/services/oauth2/token`;

        var claim = {
            iss: clientId,
            aud: baseUrl,
            sub: salesForceUser,
            exp: Math.floor(Date.now() / 1000) + 3 * 60
        };

        var token = jwt.sign(claim, privateKey, { algorithm: 'RS256' });

        console.info(`SALE000001 Collecting data for ${state.stream} from ${state.since} till ${state.until}`);

        if (state.apiQuotaResetDate && moment().isBefore(state.apiQuotaResetDate)) {
            console.log('API Request Limit Exceeded. The quota will be reset at ', state.apiQuotaResetDate);
            collector.reportApiThrottling(function () {
                return callback(null, [], state, state.poll_interval_sec);
            });
        }
        else {

            let restServiceClient = new RestServiceClient(baseUrl);

            restServiceClient.post(tokenUrl, {
                form: {
                    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                    assertion: token
                }
            }).then(response => {
                var objectQueryDetails = utils.getObjectQuery(state);
                if (!objectQueryDetails.query) {
                    return callback("The object name was not found!");
                }
                tsPaths = objectQueryDetails.tsPaths;
                utils.getObjectLogs(response, objectQueryDetails, [], state, process.env.paws_max_pages_per_invocation)
                    .then(({ accumulator, nextPage }) => {
                        let newState;
                        if (nextPage === undefined) {
                            newState = this._getNextCollectionState(state);
                        } else {
                            newState = this._getNextCollectionStateWithNextPage(state, nextPage);
                        }
                        console.info(`SALE000002 Next collection in ${newState.poll_interval_sec} seconds`);
                        return callback(null, accumulator, newState, newState.poll_interval_sec);
                    })
                    .catch((error) => {
                        if (error.errorCode && error.errorCode === "REQUEST_LIMIT_EXCEEDED") {
                            // Api will reset after next 24 hours 
                            // Added extra 1 hours for buffer
                            state.apiQuotaResetDate = moment().add(25, "hours").toISOString();
                            state.poll_interval_sec = 900;
                            console.log('API Request Limit Exceeded. The quota will be reset at ', state.apiQuotaResetDate);
                            collector.reportApiThrottling(function () {
                                return callback(null, [], state, state.poll_interval_sec);
                            });
                        }
                        else {
                            if (error.errorCode && error.errorCode === "INVALID_FIELD") {
                                console.log(`API not able to fetch field for object ${state.stream}`);
                            }
                            if (error.errorCode && error.errorCode === "INVALID_TYPE") {
                                console.log(`API not able to fetch logs for object ${state.stream}`);
                            }
                            if (error.errorCode && error.errorCode === "INVALID_SESSION_ID") {
                                console.log("User not added 'Access and manage your data (api)' in Oauth scope");
                            }
                            return callback(error);
                        }

                    });

            }).catch(err => {
                // set errorCode if not available in error object to showcase client error on DDMetrics
                if (err.error && err.error.error) {
                    err.errorCode = err.error.error;
                }
                return callback(err);
            });
        } 
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
            stream: curState.stream,
            since: nextSinceTs,
            until: nextUntilMoment.toISOString(),
            nextPage: null,
            apiQuotaResetDate: null,
            poll_interval_sec: nextPollInterval
        };
    }

    _getNextCollectionStateWithNextPage({ stream, since, until }, nextPage) {
        return {
            stream,
            since,
            until,
            nextPage,
            apiQuotaResetDate: null,
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
            progName: 'SalesforceCollector',
            message: JSON.stringify(msg),
            messageType: 'json/salesforce',
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

    setStreamToCollectionState(curState) {
        return {
            stream: curState.object,
            since: curState.since,
            until: curState.until,
            nextPage: curState.nextPage,
            apiQuotaResetDate: curState.apiQuotaResetDate,
            poll_interval_sec: curState.poll_interval_sec
        };
    }
}

module.exports = {
    SalesforceCollector: SalesforceCollector
}
