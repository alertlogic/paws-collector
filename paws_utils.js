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
    const pollIntervalDelay = process.env.paws_poll_interval_delay && process.env.paws_poll_interval_delay <= 900 ? process.env.paws_poll_interval_delay : 300;
    const nowMoment = moment();
    const nextSinceMoment = curUntilMoment.isAfter(nowMoment) ?
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
     * If current moment and nextUntilMoment difference is less than given poll_interval_delay then set nextPollInterval = poll_interval_delay;
     * make next API call after 5 to 10 min to avoid any loss of data.
     */
    let nextPollInterval;
    if (nowMoment.diff(nextUntilMoment, 'minutes') > 15) {
        nextPollInterval = 1;
    }
    else if (nowMoment.diff(nextUntilMoment, 'seconds') > pollIntervalDelay) {
        nextPollInterval = pollInterval;
    }
    else {
        nextPollInterval = pollIntervalDelay;
    }

    return { nextSinceMoment, nextUntilMoment, nextPollInterval };
}

module.exports = {
    calcNextCollectionInterval: calcNextCollectionInterval
}

