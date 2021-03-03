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

        const streams = JSON.parse(process.env.collector_streams);
        const initialStates = streams.map(stream => {
            return {
                stream,
                from_date: from_date_unix,
                poll_interval_sec: 1
            }
        });

        return callback(null, initialStates, 1);
    }

    pawsGetRegisterParameters(event, callback) {
        const regValues = {
            sophosSiemObjectNames: process.env.collector_streams
        };
        callback(null, regValues);
    }

    pawsGetLogs(state, callback) {
        let collector = this;
        // This code can remove once exsisting code set stream and collector_streams env variable
        if (!process.env.collector_streams) {
            collector.setCollectorStreamsEnv(process.env.paws_collector_param_string_1);
        }
        if (!state.stream) {
            state = collector.setStreamToCollectionState(state);
        }
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

        let messageString = state.nextPage ? collector.decodebase64string(state.nextPage) : `from ${moment.unix(parseInt(state.from_date)).format("YYYY-MM-DDTHH:mm:ssZ")}`;

        console.info(`SIEM000001 Collecting data for ${state.stream} ${messageString}`);

        utils.getAPILogs(APIHostName, headers, state, [], process.env.paws_max_pages_per_invocation)
            .then(({ accumulator, nextPage, has_more }) => {
                const newState = collector._getNextCollectionState(state, nextPage, has_more);
                console.info(`SIEM000002 Next collection in ${newState.poll_interval_sec} seconds`);
                return callback(null, accumulator, newState, newState.poll_interval_sec);
            }).catch((error) => {
                // set errorCode if not available in error object to showcase client error on DDMetric
                error.errorCode = error.statusCode;
                if (error.statusCode && error.statusCode === 401) {
                    console.log('Token expired or customer not authorized to make api call');
                    return callback(error);
                }
                else if (error.statusCode && error.statusCode === 429) {
                    state.poll_interval_sec = 900;
                    console.log('API Request Limit Exceeded.');
                    collector.reportApiThrottling(function () {
                        return callback(null, [], state, state.poll_interval_sec);
                    });
                }
                else {
                    return callback(error);
                }
            });
    }

    _getNextCollectionState(curState, nextPage, has_more) {
        let nextPollInterval;
        if (nextPage) {
            if (has_more) {
                nextPollInterval = 1;
            }
            else {
                nextPollInterval = this.pollInterval;
            }

            return {
                stream: curState.stream,
                nextPage: nextPage,
                poll_interval_sec: nextPollInterval
            };
        }
        else {
            // This condition works if next page getting null or undefined
            return {
                stream: curState.stream,
                from_date: moment().unix(),
                poll_interval_sec: 1
            };
        }
    }

    decodebase64string(nextPage) {

        const regex = /((-?(?:[1-9][0-9]*)?[0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(\.[0-9]+)?(Z))/g;
        let base64String = Buffer.from(nextPage, 'base64').toString('utf-8');
        const found = base64String.match(regex);
        let messageString = "";
        if (found) {
            messageString = found.length == 2 ? `from ${found[0]} till ${found[1]}` : `from ${found[0]}`;
        }

        return messageString;
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

    setStreamToCollectionState(curState) {
        return {
            stream: curState.objectName,
            from_date: curState.from_date,
            poll_interval_sec: curState.poll_interval_sec
        };
    }
}

module.exports = {
    SophossiemCollector: SophossiemCollector
}
