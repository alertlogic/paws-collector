/* -----------------------------------------------------------------------------
 * @copyright (C) 2021, Alert Logic, Inc
 * @doc
 *
 * crowdstrike class.
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


let typeIdPaths = [];

let tsPaths = [];


class CrowdstrikeCollector extends PawsCollector {
    constructor(context, creds) {
        super(context, creds, packageJson.version);
    }

    async pawsInitCollectionState(event) {
        const startTs = process.env.paws_collection_start_ts ?
            process.env.paws_collection_start_ts :
            moment().toISOString();
        const endTs = moment(startTs).add(this.pollInterval, 'seconds').toISOString();
        const apiNames = JSON.parse(process.env.collector_streams);
        const initialStates = apiNames.map(stream => {
            return {
                stream,
                since: startTs,
                until: endTs,
                offset: 0,
                poll_interval_sec: 1
            }
        });
        return { state: initialStates, nextInvocationTimeout: 1 };
    }

    pawsGetRegisterParameters(event) {
        const regValues = {
            crowdstrikeAPINames: process.env.collector_streams
        };

        return regValues;
    }

    async pawsGetLogs(state) {
        let collector = this;

        const clientSecret = collector.secret;
        if (!clientSecret) {
            throw new Error("The Client Secret was not found!");
        }
        const clientId = collector.clientId;
        if (!clientId) {
            throw new Error("The Client ID was not found!");
        }

        const APIHostName = collector.pawsDomainEndpoint.replace(/^https:\/\/|\/$/g, '');
        const apiDetails = utils.getAPIDetails(state);
        typeIdPaths = apiDetails.typeIdPaths;
        tsPaths = apiDetails.tsPaths;

        AlLogger.info(`CROW000001 Collecting data from ${state.since} till ${state.until} from ${state.stream}`);

        let token;
        try {
            token = await utils.authenticate(APIHostName, clientId, clientSecret);
        } catch (error) {
            AlLogger.error(`CROW000002 Error while getting Authentication`);
            collector.setErrorCode(error);
        }

        let accumulator;
        let total;
        try {
            ({ accumulator, total } = await utils.getList(apiDetails, [], APIHostName, token));
        } catch (error) {
            AlLogger.error(`CROW000003 Error while getting API details`);
            collector.setErrorCode(error);
        }

        const receivedAll = (state.offset + accumulator.length) >= total;
        const offset = receivedAll ? 0 : (state.offset + accumulator.length);
        const newState = collector._getNextCollectionStateWithOffset(state, offset, receivedAll);

        try {
            if (state.stream === 'Incident') {
                const data = await utils.getIncidents(accumulator, APIHostName, token);
                AlLogger.info(`CROW000004 Next collection in ${newState.poll_interval_sec} seconds for ${state.stream}`);
                return [data.resources, newState, newState.poll_interval_sec];
            } else if (state.stream === 'Detection') {
                const data = await utils.getDetections(accumulator, APIHostName, token);
                AlLogger.info(`CROW000004 Next collection in ${newState.poll_interval_sec} seconds for ${state.stream}`);
                return [data.resources, newState, newState.poll_interval_sec];
            } else if (state.stream === 'Alerts') {
                const data = await utils.getAlerts(accumulator, APIHostName, token);
                AlLogger.info(`CROW000004 Next collection in ${newState.poll_interval_sec} seconds for ${state.stream}`);
                return [data.resources, newState, newState.poll_interval_sec];
            }
            throw new Error(`CROW000006 Unsupported stream: ${state.stream}`);
        } catch (error) {
            AlLogger.error(`CROW000005 Error while getting ${state.stream} details`);
            collector.setErrorCode(error);
        }
    }

    setErrorCode(error) {
        if (error.response && error.response.data) {
            error.response.data.errorCode = error.response.data.errors[0] ? error.response.data.errors[0].code : error.response.status;
            throw error.response.data;
        }
        else if (error.response && error.response.status) {
            error.errorCode = error.response.status;
            throw error;
        } else {
            throw error;
        }
    }

    _getNextCollectionStateWithOffset(curState, offset, receivedAll) {
        const untilMoment = moment(curState.until);
        const { nextUntilMoment, nextSinceMoment, nextPollInterval } = calcNextCollectionInterval('hour-cap', untilMoment, this.pollInterval);
        return {
            stream: curState.stream,
            since: receivedAll ? nextSinceMoment.toISOString() : curState.since,
            until: receivedAll ? nextUntilMoment.toISOString() : curState.until,
            offset: offset,
            poll_interval_sec: nextPollInterval
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
            progName: 'CrowdstrikeCollector',
            message: JSON.stringify(msg),
            messageType: 'json/crowdstrike',
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
    CrowdstrikeCollector: CrowdstrikeCollector
}
