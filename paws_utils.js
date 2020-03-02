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

    const nextPollInterval = nowMoment.diff(nextUntilMoment, 'seconds') > pollInterval ?
            1 : pollInterval;

    return { nextSinceMoment, nextUntilMoment, nextPollInterval };
}

module.exports = {
    calcNextCollectionInterval: calcNextCollectionInterval
}

