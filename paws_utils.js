/* -----------------------------------------------------------------------------
 * @copyright (C) 2020, Alert Logic, Inc
 * @doc
 *
 * Utility functions for PAWS collector
 *
 * @end
 * -----------------------------------------------------------------------------
 */
'use strict';

const moment = require('moment');
const NEXT_POLL_INTERVAL_DELAY = process.env.paws_poll_interval_delay && process.env.paws_poll_interval_delay <= 900 ? process.env.paws_poll_interval_delay : 600;

function calcNextCollectionInterval(strategy, curUntilMoment, pollInterval) {
    const nowMoment = moment();
    const nextSinceMoment = curUntilMoment.isAfter(nowMoment) ?
        nowMoment : curUntilMoment;

    let nextUntilMoment;

    switch(strategy) {
        case 'day-week-progression':
            if (nowMoment.diff(nextSinceMoment, 'days') > 7) {
                nextUntilMoment = moment(nextSinceMoment).add(7, 'days');
            }
            else if (nowMoment.diff(nextSinceMoment, 'days') > 1) {
                nextUntilMoment = moment(nextSinceMoment).add(24, 'hours');
            }
            else {
                nextUntilMoment = moment(nextSinceMoment).add(pollInterval, 'seconds');
            }
            break;
        case 'hour-day-progression':
            if (nowMoment.diff(nextSinceMoment, 'hours') > 24) {
                nextUntilMoment = moment(nextSinceMoment).add(24, 'hours');
            }
            else if (nowMoment.diff(nextSinceMoment, 'hours') > 1) {
                nextUntilMoment = moment(nextSinceMoment).add(1, 'hours');
            }
            else {
                nextUntilMoment = moment(nextSinceMoment).add(pollInterval, 'seconds');
            }
            break;
        case 'hour-cap':
            if (nowMoment.diff(nextSinceMoment, 'hours') > 1) {
                nextUntilMoment = moment(nextSinceMoment).add(1, 'hours');
            }
            else {
                nextUntilMoment = moment(nextSinceMoment).add(pollInterval, 'seconds');
            }
            break;
        case 'day-cap':
            if (nowMoment.diff(nextSinceMoment, 'hours') > 24) {
                nextUntilMoment = moment(nextSinceMoment).add(24, 'hours');
            }
            else {
                nextUntilMoment = moment(nextSinceMoment).add(pollInterval, 'seconds');
            }
            break;
        case 'no-cap':
            nextUntilMoment = moment(nextSinceMoment).add(pollInterval, 'seconds');
            break;
        default:
            throw new Error("Unknow strategy for capping next until timestamp!");
    }

    /**
     * If current time and nextUntilMoment difference is less the NEXT_POLL_INTERVAL_DELAY seconds,
     * then pull the data for 1 min to keep the poll interval delay consistance and get whole data and not missed anything.
     */
    if (nowMoment.diff(nextUntilMoment, 'seconds') < NEXT_POLL_INTERVAL_DELAY) {
        nextUntilMoment = moment(nextSinceMoment).add(60, 'seconds');
    }

    // If current time and nextUntilMoment difference is less the 10 min then set nextPollInterval to 10 min(600 sec) else 1 sec.
    const nextPollInterval = nowMoment.diff(nextUntilMoment, 'seconds') > NEXT_POLL_INTERVAL_DELAY ?
        1 : NEXT_POLL_INTERVAL_DELAY;
    return { nextSinceMoment, nextUntilMoment, nextPollInterval };
}

module.exports = {
    calcNextCollectionInterval: calcNextCollectionInterval
}

