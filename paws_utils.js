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

function calcNextCollectionInterval(strategy, curUntilMoment, pollInterval) {
    const NEXT_POLL_INTERVAL_DELAY = process.env.paws_poll_interval_delay && process.env.paws_poll_interval_delay <= 900 ? process.env.paws_poll_interval_delay : 600;
    const nowMoment = moment();
    let nextSinceMoment = curUntilMoment.isAfter(nowMoment) ?
        nowMoment : curUntilMoment;
    const daysDiff = nowMoment.diff(nextSinceMoment, 'days');
    const hoursDiff = nowMoment.diff(nextSinceMoment, 'hours');
    let nextUntilMoment;

    switch(strategy) {
        case 'day-week-progression':
            if (daysDiff > 7) {
                nextUntilMoment = moment(nextSinceMoment).add(7, 'days');
            }
            else if (daysDiff > 1) {
                nextUntilMoment = moment(nextSinceMoment).add(24, 'hours');
            }
            else {
                nextUntilMoment = moment(nextSinceMoment).add(pollInterval, 'seconds');
            }
            break;
        case 'hour-day-progression':
            if (hoursDiff > 24) {
                nextUntilMoment = moment(nextSinceMoment).add(24, 'hours');
            }
            else if (hoursDiff > 1) {
                nextUntilMoment = moment(nextSinceMoment).add(1, 'hours');
            }
            else {
                nextUntilMoment = moment(nextSinceMoment).add(pollInterval, 'seconds');
            }
            break;
        case 'hour-cap':
            if (hoursDiff > 1) {
                nextUntilMoment = moment(nextSinceMoment).add(1, 'hours');
            }
            else {
                nextUntilMoment = moment(nextSinceMoment).add(pollInterval, 'seconds');
            }
            break;
        case 'day-cap':
            if (hoursDiff > 24) {
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
     * then nextUntilMoment value will be given poll_interval_delay second ago;
     * and if sinceMoment > UntilMoment then set both value to same so API will not pull any data.
     */
    if (nowMoment.diff(nextUntilMoment, 'seconds') < NEXT_POLL_INTERVAL_DELAY) {
        nextUntilMoment = nowMoment.subtract(NEXT_POLL_INTERVAL_DELAY, 'seconds');
        if (nextSinceMoment.isAfter(nextUntilMoment)) {
            nextSinceMoment = nextUntilMoment;
        }
    }
    // set nextPollInterval in seconds base on different scenario.
    let nextPollInterval;
    if (nowMoment.diff(nextUntilMoment, 'hours') > 1) {
        nextPollInterval = 1;
    }
    else if (nowMoment.diff(nextUntilMoment, 'seconds') > NEXT_POLL_INTERVAL_DELAY) {
        nextPollInterval = pollInterval;
    }
    else {
        nextPollInterval = NEXT_POLL_INTERVAL_DELAY;
    }

    if (nextSinceMoment === nextUntilMoment) {
        console.info(`Since and untill moment is same and Next collection in ${nextPollInterval} seconds`);
    }

    return { nextSinceMoment, nextUntilMoment, nextPollInterval };
}

module.exports = {
    calcNextCollectionInterval: calcNextCollectionInterval
}

