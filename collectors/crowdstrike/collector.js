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
const packageJson = require('./package.json');
const utils = require("./utils");
const calcNextCollectionInterval = require('@alertlogic/paws-collector').calcNextCollectionInterval;


let typeIdPaths = [];

let tsPaths = [];


class CrowdstrikeCollector extends PawsCollector {
    constructor(context, creds) {
        super(context, creds, packageJson.version);
    }
    
    pawsInitCollectionState(event, callback) {
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
        return callback(null, initialStates, 1);
    }

    pawsGetRegisterParameters(event, callback) {
        const regValues = {
            crowdstrikeAPINames: process.env.collector_streams
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

        const APIHostName = collector.pawsDomainEndpoint.replace(/^https:\/\/|\/$/g, '');
        const apiDetails = utils.getAPIDetails(state);
        typeIdPaths = apiDetails.typeIdPaths;
        tsPaths = apiDetails.tsPaths;

        console.info(`CROW000001 Collecting data from ${state.since} till ${state.until} from ${state.stream}`);

        utils.authenticate(APIHostName, clientId, clientSecret).then((token) => {
            utils.getList(apiDetails, [], APIHostName, token).then(({accumulator, total}) => {             
                const receivedAll = (state.offset + accumulator.length) >= total ? true : false;
                const offset = receivedAll ? 0 : (state.offset + accumulator.length);
                if (state.stream === 'Incident') {
                    return utils.getIncidents(accumulator, APIHostName, token).then((data) => {
                        const newState = collector._getNextCollectionStateWithOffset(state, offset, receivedAll);
                        console.info(`CROW000004 Next collection in ${newState.poll_interval_sec} seconds for ${state.stream}`);
                        return callback(null, data.resources, newState, newState.poll_interval_sec);
                    }).catch((error) => {
                        console.error(`CROW000005 Error while getting incident details`);
                        error.errorCode = error.statusCode;
                        return callback(error);
                    });
                } else if (state.stream === 'Detection') {
                    return utils.getDetections(accumulator, APIHostName, token).then((data) => {
                        const newState = collector._getNextCollectionStateWithOffset(state, offset, receivedAll);
                        console.info(`CROW000004 Next collection in ${newState.poll_interval_sec} seconds for ${state.stream}`);
                        return callback(null, data.resources, newState, newState.poll_interval_sec);
                    }).catch((error) => {
                        console.error(`CROW000005 Error while getting detection details`);
                        error.errorCode = error.statusCode;
                        return callback(error);
                    });
                }
            }).catch((error) => {
                console.error(`CROW000003 Error while getting API details`);
                error.errorCode = error.statusCode;
                return callback(error);
            });
        }).catch((error) => {
            console.error(`CROW000002 Error while getting Authentication`);
            error.errorCode = error.statusCode;
            return callback(error);
        });        
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
