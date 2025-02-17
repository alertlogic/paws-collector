/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * O365 System logs extension.
 *
 * @end
 * -----------------------------------------------------------------------------
 */

const debug = require('debug')('index');
const AlLogger = require('@alertlogic/al-aws-collector-js').Logger;

const O365Collector = require('./o365_collector').O365Collector;
const express = require('express');


const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const handleEventRequest = (req, res) => {
    require('dotenv').config({ path: __dirname + '/local/.env' })
    const event = req.body;
    const context = { awsRequestId: 1, invokedFunctionArn: "arn:aws:lambda:us-east-1:352283894008:function:imo365newfromlocal1" }

    debug('input event: ', event);
    AlLogger.defaultMeta = { requestId: context.awsRequestId };
    O365Collector.load().then(function (creds) {
        var o365c = new O365Collector(context, creds);
        o365c.handleEvent(event);
    }).catch(error => {
        AlLogger.error(`O365000006 error in creating object ${error}`);
        return error;
    });
};

app.post('/event', handleEventRequest);

setInterval(() => {
    let messageId = require('crypto').randomUUID()
    const fs = require('fs');

    // Read local/events/event_poll.json file and set to collect poll event
    let rawData = fs.readFileSync('local/events/event_poll.json');
    let event = { "body": JSON.parse(rawData) };
    event.body.Records[0].messageId = messageId;
    console.log(JSON.stringify(event,0,2));
    handleEventRequest(event)
}, 10000)

app.listen(port, () => {
    console.log(`Paws app listening on port ${port}`);
});

exports.handler = O365Collector.makeHandler(function (event, context) {
    debug('input event: ', event);
    AlLogger.defaultMeta = { requestId: context.awsRequestId };
    O365Collector.load().then(function (creds) {
        var o365c = new O365Collector(context, creds);
        o365c.handleEvent(event);
    }).catch(error => {
        AlLogger.error(`O365000006 error in creating object ${error}`);
        return error;
    });
});
