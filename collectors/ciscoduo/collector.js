/* -----------------------------------------------------------------------------
 * @copyright (C) 2020, Alert Logic, Inc
 * @doc
 *
 * ciscoduo class.
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
const duo = require('@duosecurity/duo_api');
const utils = require("./utils");
const calcNextCollectionInterval = require('@alertlogic/paws-collector').calcNextCollectionInterval;


let typeIdPaths = [];

let tsPaths = [];

const Authentication = 'Authentication';
const API_THROTTLING_ERROR = 42901;
const MAX_POLL_INTERVAL = 900;
const POLL_INTERVAL_SECS = 60;

class CiscoduoCollector extends PawsCollector {
    constructor(context, creds) {
        super(context, creds, packageJson.version);
    }

    async pawsInitCollectionState(event) {
        const startTs = process.env.paws_collection_start_ts ?
            process.env.paws_collection_start_ts :
            moment().toISOString();
        const endTs = moment(startTs).add(this.pollInterval, 'seconds').toISOString();
        const objectNames = JSON.parse(process.env.collector_streams);
        const pollInterval = objectNames.length * POLL_INTERVAL_SECS;
        // All streams now use 13-digit millisecond timestamps to match v2 API requirements.
        const initialStates = objectNames.map(stream => {
            return {
                stream,
                since: moment(startTs).valueOf(),
                until: moment(endTs).valueOf(),
                nextPage: null,
                poll_interval_sec: pollInterval
            };
        });
        return { state: initialStates, nextInvocationTimeout: pollInterval };
    }

    async pawsGetRegisterParameters(event) {
        const regValues = {
            ciscoduoObjectNames: process.env.collector_streams
        };
        return regValues;
    }

    async pawsGetLogs(state) {
        let collector = this;
        // This code can remove once exsisting code set stream and collector_streams env variable
        if (!process.env.collector_streams) {
            collector.setCollectorStreamsEnv(process.env.paws_collector_param_string_1);
        }
        if (!state.since) {
            state = collector.setSinceUntilToCollectionState(state);
        }
        const clientSecret = collector.secret;
        if (!clientSecret) {
            throw new Error("The Client Secret was not found!");
        }
        const clientId = collector.clientId;
        if (!clientId) {
            throw new Error("The Client ID was not found!");
        }

        const hostName = collector.pawsDomainEndpoint;
        if (!hostName) {
            throw new Error("The Host Name was not found!");
        }

        const client = new duo.Client(clientId, clientSecret, hostName);

        var objectDetails = utils.getAPIDetails(state);
        if (!objectDetails.url) {
            throw new Error("The object name was not found!");
        }

        typeIdPaths = objectDetails.typeIdPaths;
        tsPaths = objectDetails.tsPaths;
        // All streams now store since/until as milliseconds — no stream-specific conversion needed.
        const stateUntil = state.until ? `till ${moment(parseInt(state.until)).toISOString()}` : ``;
        const stateSince = moment(parseInt(state.since)).toISOString();

        AlLogger.info(`CDUO000001 Collecting data for ${state.stream} from ${stateSince} ${stateUntil}`);
        try {
            const { accumulator, nextPage } = await utils.getAPILogs(client, objectDetails, state, [], process.env.paws_max_pages_per_invocation);
            let newState;
            if (nextPage === undefined) {
                newState = this._getNextCollectionState(state);
            } else {
                newState = this._getNextCollectionStateWithNextPage(state, nextPage);
            }
            AlLogger.info(`CDUO000002 Next collection in ${newState.poll_interval_sec} seconds`);
            return [accumulator, newState, newState.poll_interval_sec];
        } catch (error) {
            if (this._isThrottlingError(error)) {
                return await this.handleThrottlingError(error, state);
            }
            throw this.handleOtherErrors(error);
        }
    }

    _isThrottlingError(error) {
        return !!(error && typeof error === 'object' &&
            (error.code === API_THROTTLING_ERROR || error.errorCode === API_THROTTLING_ERROR));
    }

    async handleThrottlingError(error, state) {
        // Cisco duo api has some rate limits that we might run into.
        // If we run into a rate limit error, instead of returning the error,
        // We return the state back to the queue with an additional 60 secs.
        state.poll_interval_sec = state.poll_interval_sec < MAX_POLL_INTERVAL ?
            state.poll_interval_sec + POLL_INTERVAL_SECS : MAX_POLL_INTERVAL;
        AlLogger.warn(`CDUO000003 API Request Limit Exceeded ${JSON.stringify(error)}`);
        await this.reportApiThrottling();
        return [[], state, state.poll_interval_sec];
    }

    handleOtherErrors(error) {
        if (error && typeof error === 'object') {
            if (error.errorCode === undefined) {
                error.errorCode = error.code || error.status;
            }
            return error;
        }

        return {
            errorCode: null,
            message: typeof error === 'string' ? error : String(error)
        };
    }

    _getNextCollectionState(curState) {
        // All streams use millisecond timestamps and hour-cap interval logic.
        // Fall back to now if `until` is absent (old in-flight SQS message without `until`).
        const untilRaw = curState.until != null ? parseInt(curState.until) : moment().valueOf();
        const untilMs = untilRaw < utils.MIN_13_DIGIT_TIMESTAMP ? untilRaw * 1000 : untilRaw;
        const untilMoment = moment(untilMs);

        
        // Authentication is the high-traffic stream and uses the 60 s baseline so a single
        // window stays small. Administrator, OfflineEnrollment and Telephony are low-traffic
        // (and Administrator + OfflineEnrollment share /admin/v2/logs/activity), so we widen
        // their window to 15 min per call to halve the request rate on that shared endpoint.
        const isHighTrafficStream = curState.stream === Authentication;
        const streamPollInterval = isHighTrafficStream ? this.pollInterval : MAX_POLL_INTERVAL;

        const { nextUntilMoment, nextSinceMoment, nextPollInterval } =
            calcNextCollectionInterval('hour-cap', untilMoment, streamPollInterval);

        // Per-stream cadence to respect Duo's per-endpoint ~1 call/min throttling limit.
        let nextPollIntervalSec = nextPollInterval >= POLL_INTERVAL_SECS ? nextPollInterval : POLL_INTERVAL_SECS;

        // For low-traffic streams that are caught up to real-time, force the next
        // invocation to wait the full 15 min window — otherwise calcNextCollectionInterval
        // would return paws_poll_interval_delay (default 300 s) and we'd poll a window
        // whose `until` is still in the future. We only override when the next window is
        // not in backfill territory (nextPollInterval > 1 means we are not far behind).
        let until = nextUntilMoment.valueOf();
        if (!isHighTrafficStream && nextPollInterval > 1) {
            nextPollIntervalSec = MAX_POLL_INTERVAL;
            // Only subtract 2 min if `until` extends into the future (real-time window) to avoid loss of data.
            // If already in the past (collector is lagging), collect the full 15-min window as-is.
            const TWO_MIN_DELAY_SEC = 120;
            if (nextUntilMoment.isAfter(moment())) {
                until = moment(nextUntilMoment).subtract(TWO_MIN_DELAY_SEC, 'seconds').valueOf();
            }
        }

        return {
            stream: curState.stream,
            since: nextSinceMoment.valueOf(),
            until: until,
            nextPage: null,
            poll_interval_sec: nextPollIntervalSec
        };
    }

    _getNextCollectionStateWithNextPage(curState, nextPage) {
        // All streams: preserve the same time window and store the cursor for the next invocation.
        // nextPage is a next_offset cursor string, not a timestamp — never use it as `since`.
        return {
            stream: curState.stream,
            since: curState.since,
            until: curState.until,
            nextPage: nextPage,
            poll_interval_sec: POLL_INTERVAL_SECS
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
            progName: 'CiscoduoCollector',
            message: JSON.stringify(msg),
            messageType: 'json/ciscoduo',
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

    setSinceUntilToCollectionState(curState) {
        if (curState.stream === Authentication) {
            return {
                stream: curState.stream,
                since: curState.mintime,
                until: curState.maxtime,
                nextPage: curState.nextPage,
                poll_interval_sec: curState.poll_interval_sec
            };
        } else {
            return {
                stream: curState.stream,
                since: curState.mintime,
                poll_interval_sec: curState.poll_interval_sec
            };
        }
    }
}

module.exports = {
    CiscoduoCollector: CiscoduoCollector
}
