/* -----------------------------------------------------------------------------
 * @copyright (C) 2020, Alert Logic, Inc
 * @doc
 *
 * mimecast class.
 *
 * @end
 * -----------------------------------------------------------------------------
 */
'use strict';

const moment = require('moment');
const PawsCollector = require('@alertlogic/paws-collector').PawsCollector;
const parse = require('@alertlogic/al-collector-js').Parse;
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;
const calcNextCollectionInterval = require('@alertlogic/paws-collector').calcNextCollectionInterval;
const packageJson = require('./package.json');
const utils = require("./utils");


let typeIdPaths = [];

let tsPaths = [];

const Siem_Logs = 'SiemLogs';
const Malware_Feed = 'MalwareFeed';


class MimecastCollector extends PawsCollector {
    constructor(context, creds) {
        super(context, creds, packageJson.version);
    }

    async pawsInitCollectionState(event) {
        const startTs = process.env.paws_collection_start_ts ?
            process.env.paws_collection_start_ts :
            moment().toISOString();
        const endTs = moment(startTs).add(this.pollInterval, 'seconds').utc().format();

        const applicationNames = JSON.parse(process.env.collector_streams);
        const initialStates = applicationNames.map(stream => {
            if (stream === Siem_Logs || stream === Malware_Feed) {
                return {
                    stream,
                    currentTs: moment().toISOString(),
                    nextPage: null,
                    poll_interval_sec: 1
                }
            }
            else {
                return {
                    stream,
                    since: startTs,
                    until: endTs,
                    nextPage: null,
                    poll_interval_sec: 1
                }
            }
        });
        return { state: initialStates, nextInvocationTimeout: 1 };
    }

    async pawsGetRegisterParameters(event) {
        const regValues = {
            mimecastApplicationNames: process.env.collector_streams
        };
        return regValues;
    }

    async pawsGetLogs(state) {
        let collector = this;

        const secretKey = collector.secret;
        if (!secretKey) {
            throw new Error("The secret key was not found!");
        }
        const accessKey = collector.clientId;
        if (!accessKey) {
            throw new Error("The access key was not found!");
        }

        const baseUrl = collector.pawsDomainEndpoint;
        if (!baseUrl) {
            throw new Error("The Endpoint was not found!");
        }

        const appId = process.env.paws_collector_param_string_1;
        if (!appId) {
            throw new Error("The app Id was not found!");
        }

        const appKey = process.env.paws_collector_param_string_2;
        if (!appKey) {
            throw new Error("The app key was not found!");
        }

        let authDetails = {
            "baseUrl": baseUrl,
            "accessKey": accessKey,
            "secretKey": secretKey,
            "appId": appId,
            "appKey": appKey
        };

        let typeIdAndTsPaths = utils.getTypeIdAndTsPaths(state.stream);
        typeIdPaths = typeIdAndTsPaths.typeIdPaths;
        tsPaths = typeIdAndTsPaths.tsPaths;

        if (state.stream === Siem_Logs || state.stream === Malware_Feed) {
            AlLogger.info(`MIME000001 Collecting data for ${state.stream}`);
        } else {
            AlLogger.info(`MIME000002 Collecting data for ${state.stream} from ${state.since} till ${state.until}`);
        }

        try {
            const { accumulator, nextPage } = await utils.getAPILogs(authDetails, state, [], process.env.paws_max_pages_per_invocation);
            let newState;
            if (nextPage === undefined) {
                newState = this._getNextCollectionState(state);
            } else {
                newState = this._getNextCollectionStateWithNextPage(state, nextPage);
            }
            AlLogger.info(`MIME000003 Next collection in ${newState.poll_interval_sec} seconds`);
            return [accumulator, newState, newState.poll_interval_sec];
        } catch (error) {
            if (error.response && error.response.status == 429) {
                state.poll_interval_sec = 900;
                AlLogger.warn("MIME000004 The Mimecast service you're trying to access is temporarily busy. Please try again in a few minutes and then contact your IT helpdesk if you still have problems.");
                await collector.reportApiThrottling();
                return [[], state, state.poll_interval_sec];
            }
            else {
                if (error.response && error.response.data) {
                    error.response.data.errorCode = error.response.status;
                    if (state.stream === Siem_Logs) {
                        const bufferData = Buffer.from(error.response.data, 'utf-8');
                        const bufferString = bufferData.toString('utf-8');
                        try {
                            const parseError = JSON.parse(bufferString);
                            throw parseError;
                        } catch (err) {
                            throw error;
                        }
                    }
                    else {
                        throw error.response.data;
                    }
                }
                else {
                    error.errorCode = error.code ? error.code : (error.response && error.response.status);
                    throw error;
                }
            }
        }

    }

    _getNextCollectionState(curState) {
        if (curState.stream === Siem_Logs || curState.stream === Malware_Feed) {
            return {
                stream: curState.stream,
                currentTs: moment().toISOString(),
                nextPage: null,
                poll_interval_sec: 1
            }
        }
        else {
            const untilMoment = moment(curState.until);
            const { nextUntilMoment, nextSinceMoment, nextPollInterval } = calcNextCollectionInterval('hour-day-progression', untilMoment, this.pollInterval);
            return {
                stream: curState.stream,
                since: nextSinceMoment.utc().format(),
                until: nextUntilMoment.utc().format(),
                nextPage: null,
                poll_interval_sec: nextPollInterval
            };
        }
    }

    _getNextCollectionStateWithNextPage(curState, nextPage) {
        if (curState.stream === Siem_Logs || curState.stream === Malware_Feed) {
            return {
                stream: curState.stream,
                currentTs: moment().toISOString(),
                nextPage: nextPage,
                poll_interval_sec: 1
            }
        }
        else {
            return {
                stream: curState.stream,
                since: curState.since,
                until: curState.until,
                nextPage: nextPage,
                poll_interval_sec: 1
            };
        }
    }

    pawsFormatLog(msg) {
        let collector = this;

        const ts = parse.getMsgTs(msg, tsPaths);
        const typeId = parse.getMsgTypeId(msg, typeIdPaths);

        let formattedMsg = {
            hostname: collector.collector_id,
            messageTs: ts.sec,
            priority: 11,
            progName: 'MimecastCollector',
            message: JSON.stringify(msg),
            messageType: 'json/mimecast',
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
    MimecastCollector: MimecastCollector
}
