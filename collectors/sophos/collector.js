/* -----------------------------------------------------------------------------
 * @copyright (C) 2020, Alert Logic, Inc
 * @doc
 *
 * sophos class.
 *
 * @end
 * -----------------------------------------------------------------------------
 */
'use strict';

const moment = require('moment');
const PawsCollector = require('@alertlogic/paws-collector').PawsCollector;
const parse = require('@alertlogic/al-collector-js').Parse;
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;
const packageJson = require('./package.json');
const utils = require("./utils");
const calcNextCollectionInterval = require('@alertlogic/paws-collector').calcNextCollectionInterval;

const typeIdPaths = [{ path: ['id'] }];

const tsPaths = [{ path: ["raisedAt"] }];

//Sophos base endpoints. These appear to be universal per the docs
const SOPHOS_AUTH_BASE_URL = "id.sophos.com";
const SOPHOS_API_BASE_URL = "api.central.sophos.com";

class SophosCollector extends PawsCollector {
    constructor(context, creds) {
        super(context, creds, packageJson.version);
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
            apiQuotaResetDate: null,
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
        
        AlLogger.info(`SOPH000001 Collecting data from ${state.since} till ${state.until}`);

        if (state.apiQuotaResetDate && moment().isBefore(state.apiQuotaResetDate)) {
            AlLogger.info(`API Request Limit Exceeded. The quota will be reset at ${state.apiQuotaResetDate}`);
            collector.reportApiThrottling(function () {
                return callback(null, [], state, state.poll_interval_sec);
            });
        }
        else {

            utils.authenticate(SOPHOS_AUTH_BASE_URL, clientId, clientSecret).then((token) => {
                // while runing on live api server pass getTenantIdAndDataRegion hostname value "api.central.sophos.com"
                utils.getTenantIdAndDataRegion(SOPHOS_API_BASE_URL, token).then((response) => {
                    if (!response.apiHosts.dataRegion) {
                        return callback("Please generate credentials for the tenant. Currently we do not support credentials for Organization and Partner.");
                    }
                    const apiHostsURL = response.apiHosts.dataRegion.replace(/^https:\/\/|\/$/g, '');
                    utils.getAPILogs(apiHostsURL, token, response.id, state, [], process.env.paws_max_pages_per_invocation)
                        .then(({ accumulator, nextPage }) => {
                            let newState;
                            if (nextPage === undefined) {
                                newState = this._getNextCollectionState(state);
                            } else {
                                newState = this._getNextCollectionStateWithNextPage(state, nextPage);
                            }
                            AlLogger.info(`SOPH000002 Next collection in ${newState.poll_interval_sec} seconds`);
                            return callback(null, accumulator, newState, newState.poll_interval_sec);
                        }).catch((error) => {
                            if ((error.response && error.response.data && error.response.data.errorCode === "TooManyRequests") || error.response.status === 429) {
                                state.apiQuotaResetDate = moment().add(1, "hours").toISOString();
                                state.poll_interval_sec = 900;
                                AlLogger.info(`API Request Limit Exceeded. The quota will be reset at ${state.apiQuotaResetDate}`);
                                collector.reportApiThrottling(function () {
                                    return callback(null, [], state, state.poll_interval_sec);
                                });
                            }
                            else {
                                // set errorCode if not available in error object to showcase client error on DDMetric
                                if (error.response.data && !error.response.data.errorCode) {
                                    error.response.data.errorCode = error.response.status;
                                }
                                return callback(error.response.data);
                            }
                        });
                }).catch((error) => {
                    if (error.response.data && !error.response.data.errorCode) {
                        error.response.data.errorCode = error.response.status;
                    }
                    return callback(error.response.data);
                });
            }).catch((error) => {         
                    
                if (error.response && error.response.data) {
                    const errorCode = error.response.data.errorCode;
                    if (errorCode === "oauth.invalid_client_secret" || errorCode === "customer.validation") {
                        error.response.data.message = `Error code [${error.response.status}]. Invalid client secret is provided.`;
                    }
                    if (errorCode === "oauth.client_app_does_not_exist") {
                        error.response.data.message = `Error code [${error.response.status}]. Invalid client ID is provided.`;
                    }
                    return callback(error.response.data);
                }
                else {
                    error.errorCode = error.response.status;
                    return callback(error);
                }
            });
        }
    }

    _getNextCollectionState(curState) {

        const untilMoment = moment(curState.until);

        const { nextUntilMoment, nextSinceMoment, nextPollInterval } = calcNextCollectionInterval('hour-cap', untilMoment, this.pollInterval);

        return {
            since: nextSinceMoment.toISOString(),
            until: nextUntilMoment.toISOString(),
            nextPage: null,
            apiQuotaResetDate: null,
            poll_interval_sec: nextPollInterval
        };
    }

    _getNextCollectionStateWithNextPage({ since, until }, nextPage) {
        return {
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
            hostname: collector.collector_id,
            messageTs: ts.sec,
            priority: 11,
            progName: 'SophosCollector',
            message: JSON.stringify(msg),
            messageType: 'json/sophos',
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
    SophosCollector: SophosCollector
};
