/* -----------------------------------------------------------------------------
 * @copyright (C) 2020, Alert Logic, Inc
 * @doc
 *
 * ciscoduo class.
 *
 * The last log message code: CDUO000004
 * 
 * @end
 * -----------------------------------------------------------------------------
 */
'use strict';

const moment = require('moment');
const PawsCollector = require('@alertlogic/paws-collector').PawsCollector;
const parse = require('@alertlogic/al-collector-js').Parse;
const duo = require('@duosecurity/duo_api');

const LIST_PAGE_SIZE = 1000;
const DUO_ENDPOINT_AUTH = '/admin/v2/logs/authentication';
const DUO_ENDPOINT_ADMIN = '/admin/v1/logs/administrator';
const DUO_ENDPOINT_TELE = '/admin/v1/logs/telephony';
const DUO_ENDPOINT_ENROLL = '/admin/v1/logs/offline_enrollment';


const typeIdPaths = [
    { path: ['event_type'] },
    { path: ['action'] },
    { path: ['context'] }
];

const tsPaths = [
    { path: ['timestamp'] }
];


// Formatted messageTypeId is equal to endpoint a log message came from
 let messageTypeId;

class CiscoduoCollector extends PawsCollector {
    constructor(context, creds) {
        super(context, creds, 'ciscoduo');
    }
    
    pawsInitCollectionState(event, callback) {
        const startTs = process.env.paws_collection_start_ts ? 
                moment(process.env.paws_collection_start_ts) :
                moment().subtract(5, 'minutes');
        const endTs = startTs.add(1, 'seconds');
        const initialStates = [
            {
                duo_endpoint: DUO_ENDPOINT_AUTH,
                mintime: startTs.valueOf(),
                maxtime: endTs.valueOf(),
                poll_interval_sec: 1
            },
            {
                duo_endpoint: DUO_ENDPOINT_ADMIN,
                mintime: startTs.valueOf(),
                poll_interval_sec: 1
            },
            {
                duo_endpoint: DUO_ENDPOINT_TELE,
                mintime: startTs.valueOf(),
                poll_interval_sec: 1
            },
            {
                duo_endpoint: DUO_ENDPOINT_ENROLL,
                mintime: startTs.valueOf(),
                poll_interval_sec: 1
            }
        ];
        return callback(null, initialState, 1);
    }
    
    pawsGetLogs(state, callback) {
        let collector = this;
        console.info(`CDUO000001 Collecting data endpoint ${state.duo_endpoint} from ${state.mintime} till ${state.maxtime}`);
        const client = new duo.Client(collector.clientId, collector.clientSecret, process.env.paws_endpoint);
        let query = this._getDuoQuery(state);
        
        client.jsonApiCall('GET', state.duo_endpoint, query, function(res){
            if (res.stat !== 'OK') {
                console.error('CDUO000003 API call returned error: ' + res.message);
                return callback(res.message);
            } else {
                messageTypeId = state.duo_endpoint;
                return _handleDuoResults(state, res, callback);
            }
        });
    }
    
    _getDuoQuery(state) {
        let query;
        
        switch (state.duo_endpoint) {
            case DUO_ENDPOINT_AUTH:
                if (state.next_offset) {
                    query = {
                        next_offset: state.next_offset,
                        limit: LIST_PAGE_SIZE
                    };
                } else {
                    query = {
                        mintime: state.mintime,
                        maxtime: state.maxtime,
                        limit: LIST_PAGE_SIZE
                    };
                }
                break;
            default:
                query = {
                    mintime: state.mintime
                }
                break;
        }
        return query;
    }
    
    _handleDuoResults(state, res, callback) {
        let logs;
        let metadata;
        let newState;
        
        switch (state.duo_endpoint) {
            case DUO_ENDPOINT_AUTH:
                logs = res.response.authlogs;
                metadata = res.response.metadata;
                break;
            case DUO_ENDPOINT_ADMIN:
            case DUO_ENDPOINT_TELE:
            case DUO_ENDPOINT_ENROLL:
                logs = res.response;
                // Assumption that the last message timestamp is a mintime for the next collection step
                metadata = logs[logs.length-1];
                break;
            default:
                return callback(`CDUO000004 Unknown DUO API endpoint ${state.duo_endpoint}`);
                break;
        }
        newState = collector._getNextCollectionState(state, metadata);
        console.info(`CDUO000002 Next collection in ${newState.poll_interval_sec} seconds`);
        return callback(null, logs, newState, newState.poll_interval_sec);
    }
    
    _getNextCollectionState(curState, metadata) {
        // There is an intentional two minute delay in new log availability in the API response.
        // Let's be safe.
        const nowMoment = moment().subtract(5, 'minutes');
        let nextState;
        
        switch (curState.duo_endpoint) {
            case DUO_ENDPOINT_AUTH:
                if (metadata.next_offset) {
                    nextState = {
                        duo_endpoint: curState.duo_endpoint,
                        mintime: curState.mintime,
                        maxtime: curState.maxtime,
                        poll_interval_sec: 1,
                        next_offset: metadata.next_offset.join()
                    };
                } else {
                    const curMaxMoment = moment(parseInt(curState.maxtime));
                    const nextMinMoment = curMaxMoment.isAfter(nowMoment) ? nowMoment :
                            curMaxMoment;
                    const nextMaxMoment = nextMinMoment.clone().add(this.pollInterval, 'seconds');
                    // Check if we're behind collection schedule and need to catch up.
                    const nextPollInterval = nowMoment.diff(nextMaxMoment, 'seconds') > this.pollInterval ?
                            1 : this.pollInterval;
                    nextState = {
                        duo_endpoint: curState.duo_endpoint,
                        mintime: nextMinMoment.valueOf(),
                        maxtime: nextMaxMoment.valueOf(),
                        poll_interval_sec: nextPollInterval
                   };
                }
                break;
            case DUO_ENDPOINT_ADMIN:
            case DUO_ENDPOINT_TELE:
            case DUO_ENDPOINT_ENROLL:
            default:
                const nextMintime = metadata.timestamp + 1;
                const nextPollInterval = nextMintime - curState.mintime > this.pollInterval ?
                        1 : this.pollInterval;
                nextState = {
                    duo_endpoint: curState.duo_endpoint,
                    mintime: nextMintime,
                    poll_interval_sec: nextPollInterval
                };
                break;
        }
        
        return nextState;
    }
    
    pawsFormatLog(msg) {
        const ts = this._parseTs(msg);
        const typeId = parse.getMsgTypeId(msg, typeIdPaths);
        
        let formattedMsg = {
            messageTs: ts.sec,
            priority: 11,
            progName: 'CiscoDuoCollector',
            message: JSON.stringify(msg),
            messageType: 'json/cisco.duo'
        };
        
        formattedMsg.messageTypeId = messageTypeId;

        if (ts.usec) {
            formattedMsg.messageTsUs = ts.usec;
        }
        return formattedMsg;
    }
    
    // Some messages contain Unix timestamps in seconds (1532951962) 
    // and some in milliseconds (1532951895000)
    // TODO: check if auth logs actually return messages with milliseconds. 
    // Otherwise this function is not needed.
    _parseTs(msg) {
        const ts = parse.iteratePropPaths(tsPaths, msg);
        
        var digitLen = Math.log(ts) * Math.LOG10E + 1 | 0;  // for positive integers
        
        if (digitLen > 10 ) {
            return {
                sec: Math.floor(ts, 1000),
                usec: ts % 1000
            };
        } else {
            return {
                sec: ts
            };
        }
        
    }
}

module.exports = {
    CiscoduoCollector: CiscoduoCollector
}
