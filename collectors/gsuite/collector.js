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
const parse = require("@alertlogic/al-collector-js").Parse;

const { auth } = require("google-auth-library");
const utils = require("./utils");

const typeIdPaths = [{ path: ["kind"] }];

const tsPaths = [{ path: ["id", "time"] }];

class GsuiteCollector extends PawsCollector {
    constructor(context, creds) {
        super(context, creds, "gsuite");
    }

    pawsInitCollectionState(event, callback) {
        const startTs = process.env.paws_collection_start_ts
            ? process.env.paws_collection_start_ts
            : moment()
                .subtract(5, "minutes")
                .toISOString();

        const endTs = moment(startTs)
            .add(this.pollInterval, "seconds")
            .toISOString();

        const applicationNames = JSON.parse(process.env.paws_collector_param_string_2);  
        const initialStates = applicationNames.map(application => {
            return {
                application,
                since: startTs,
                until: endTs,
                nextPage: null,
                poll_interval_sec: 1
            }
        });
        return callback(null, initialStates, 1);
    }

    pawsGetRegisterParameters(event, callback){
        const regValues = {
            gsuiteScope: process.env.paws_collector_param_string_1,
            gsuiteApplicationNames: process.env.paws_collector_param_string_2
        };

        callback(null, regValues);
    }

    pawsGetLogs(state, callback) {
        let collector = this;
        const keysEnvVar = collector.secret;
        if (!keysEnvVar) {
            throw new Error("The $CREDS environment variable was not found!");
        }
        const keys = JSON.parse(keysEnvVar);
        const client = auth.fromJSON(keys);
        client.subject = collector.clientId;
        client.scopes = process.env.paws_collector_param_string_1.split(",");
        console.info(`GSUI000001 Collecting data for ${state.application} from ${state.since} till ${state.until}`);
        
        let params = state.nextPage ? {
            pageToken: state.nextPage
        } : {};

        Object.assign(params, {
            startTime: state.since,
            endTime: state.until,
            userKey: "all",
            applicationName: state.application
        });
        
        utils.listEvents(client, params, [], process.env.paws_max_pages_per_invocation)
            .then(({ accumulator, nextPage }) => {
                let newState;
                if (nextPage === undefined) {
                    newState = this._getNextCollectionState(state);
                } else {
                    newState = this._getNextCollectionStateWithNextPage(state, nextPage);
                }
                console.info(
                    `GSUI000002 Next collection in ${newState.poll_interval_sec} seconds`
                );
                return callback(null, accumulator, newState, newState.poll_interval_sec);
            })
            .catch((error) => {
                return callback(error);
            });
    }

    _getNextCollectionState(curState) {
        const nowMoment = moment();
        const curUntilMoment = moment(curState.until);

        // Check if current 'until' is in the future.
        const nextSinceTs = curUntilMoment.isAfter(nowMoment)
            ? nowMoment.toISOString()
            : curState.until;

        const nextUntilMoment = moment(nextSinceTs).add(
            this.pollInterval,
            "seconds"
        );
        // Check if we're behind collection schedule and need to catch up.
        const nextPollInterval =
            nowMoment.diff(nextUntilMoment, "seconds") > this.pollInterval
                ? 1
                : this.pollInterval;

        return {
            application: curState.application,
            since: nextSinceTs,
            until: nextUntilMoment.toISOString(),
            poll_interval_sec: nextPollInterval
        };
    }

    _getNextCollectionStateWithNextPage({ application, since, until }, nextPage) {
        return {
            application,
            since,
            until,
            nextPage,
            poll_interval_sec: 1
        }
    }

    pawsFormatLog(msg) {
        // TODO: double check that this message parsing fits your use case
        const ts = parse.getMsgTs(msg, tsPaths);
        const typeId = parse.getMsgTypeId(msg, typeIdPaths);

        let formattedMsg = {
            messageTs: ts.sec,
            priority: 11,
            progName: "GsuiteCollector",
            message: JSON.stringify(msg),
            messageType: "json/gsuite"
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
    GsuiteCollector: GsuiteCollector
};
