/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * Gsuite collector class.
 *
 * @end
 * -----------------------------------------------------------------------------
 */
"use strict";

const moment = require("moment");
const PawsCollector = require("@alertlogic/paws-collector").PawsCollector;
const calcNextCollectionInterval = require('@alertlogic/paws-collector').calcNextCollectionInterval;
const parse = require("@alertlogic/al-collector-js").Parse;
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;
const packageJson = require('./package.json');

const { GoogleAuth } = require("google-auth-library");
const utils = require("./utils");

let typeIdPaths = [{ path: ["kind"] }];

let tsPaths = [{ path: ["id", "time"] }];

class GsuiteCollector extends PawsCollector {

    constructor(context, creds) {
        super(context, creds, packageJson.version);
    }

    async pawsInitCollectionState(event) {
        const startTs = process.env.paws_collection_start_ts
            ? process.env.paws_collection_start_ts
            : moment()
                .subtract(5, "minutes")
                .toISOString();

        const endTs = moment(startTs)
            .add(this.pollInterval, "seconds")
            .toISOString();

        const applicationNames = JSON.parse(process.env.collector_streams);
        const initialStates = applicationNames.map(stream => {
            return {
                stream,
                since: startTs,
                until: endTs,
                nextPage: null,
                apiQuotaResetDate: null,
                poll_interval_sec: 1
            }
        });
        return { state: initialStates, nextInvocationTimeout: 1 };
    }

    async pawsGetRegisterParameters(event) {
        const regValues = {
            gsuiteScope: process.env.paws_collector_param_string_1,
            gsuiteApplicationNames: process.env.collector_streams
        };

        return regValues;
    }

    async pawsGetLogs(state) {
        let collector = this;
        // This code can remove once exsisting code set stream and collector_streams env variable
        if (!process.env.collector_streams) {
            collector.setCollectorStreamsEnv(process.env.paws_collector_param_string_2);
        }
        if (!state.stream) {
            state = collector.setStreamToCollectionState(state);
        }

        const keysEnvVar = collector.secret;
        if (!keysEnvVar) {
            throw new Error("The $CREDS environment variable was not found!");
        }
        const keys = JSON.parse(keysEnvVar);
        const authClient = new GoogleAuth({
            credentials: keys,
            scopes: JSON.parse(process.env.paws_collector_param_string_1)
        });
        const client = await authClient.getClient();
        if (collector.clientId) {
            client.subject = collector.clientId;
        }
        AlLogger.info(`GSUI000001 Collecting data for ${state.stream} from ${state.since} till ${state.until}`);

        let params = state.nextPage ? {
            pageToken: state.nextPage
        } : {};
        let getApiLogs;
        if (state.stream === 'alerts') {
            getApiLogs = utils.listAlerts;
            Object.assign(params, {
                filter: `startTime >= "${state.since}" AND startTime < "${state.until}"`
            });
        } else {
            getApiLogs = utils.listEvents;
            Object.assign(params, {
                startTime: state.since,
                endTime: state.until,
                userKey: "all",
                applicationName: state.stream
            });
        }
        let typeIdAndTsPaths = utils.getTypeIdAndTsPaths(state.stream);
        typeIdPaths = typeIdAndTsPaths.typeIdPaths;
        tsPaths = typeIdAndTsPaths.tsPaths;
        if (state.apiQuotaResetDate && moment().isBefore(state.apiQuotaResetDate)) {
            AlLogger.info(`API Daily Limit Exceeded. The quota will be reset at ${state.apiQuotaResetDate}`);
            await collector.reportApiThrottling();
            return [[], state, state.poll_interval_sec];
        }
        else {

            try {
                const { accumulator, nextPage } = await getApiLogs(client, params, [], process.env.paws_max_pages_per_invocation);
                let newState;
                if (nextPage === undefined) {
                    newState = this._getNextCollectionState(state);
                } else {
                    newState = this._getNextCollectionStateWithNextPage(state, nextPage);
                }
                AlLogger.info(
                    `GSUI000002 Next collection in ${newState.poll_interval_sec} seconds`
                );
                return [accumulator, newState, newState.poll_interval_sec];
            } catch (error) {
                if (error.errors && error.errors.length > 0 && error.errors[0].reason === "dailyLimitExceeded") {
                    // As per gsuite document daily limit quota will be reset at midnight Pacific Time (PT), 
                    // Get current PST time by subtracting 8 hours from UTC.
                    const pstCurrentDateTime = moment().subtract(8, "hours").toISOString();
                    // Get PST end of day datetime.
                    const pstEndDateTime = moment(pstCurrentDateTime).endOf('day');
                    const extraBufferSeconds = 60;
                    state.poll_interval_sec = 900;
                    // After crossing daily limit calculate PST time difference in seconds. 
                    // Get next day reset date time(midnight Pacific Time (PT)) in utc 
                    state.apiQuotaResetDate = moment().add(pstEndDateTime.diff(pstCurrentDateTime, 'seconds') + extraBufferSeconds, "seconds").toISOString();
                    AlLogger.info(`API Daily Limit Exceeded. The quota will be reset at ${state.apiQuotaResetDate}`);
                    await collector.reportApiThrottling();
                    return [[], state, state.poll_interval_sec];
                }
                else {
                    // set errorCode if not available in error object to showcase client error on DDMetrics
                    if (error.errors && error.errors.length > 0 && error.errors[0].reason) {
                        error.errorCode = error.errors[0].reason;
                    };
                    throw error;
                }
            }
        }
    }

    _getNextCollectionState(curState) {

        const untilMoment = moment(curState.until);

        const { nextUntilMoment, nextSinceMoment, nextPollInterval } = calcNextCollectionInterval('hour-day-progression', untilMoment, this.pollInterval);

        return {
            stream: curState.stream,
            since: nextSinceMoment.toISOString(),
            until: nextUntilMoment.toISOString(),
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
            progName: "GsuiteCollector",
            message: JSON.stringify(msg),
            messageType: "json/gsuite",
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

    setStreamToCollectionState(curState) {
        return {
            stream: curState.application,
            since: curState.since,
            until: curState.until,
            nextPage: curState.nextPage,
            apiQuotaResetDate: curState.apiQuotaResetDate,
            poll_interval_sec: curState.poll_interval_sec
        };
    }
}

module.exports = {
    GsuiteCollector: GsuiteCollector
};
