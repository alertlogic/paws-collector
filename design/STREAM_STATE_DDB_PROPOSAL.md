# Fix Collection States Proposal

## Problem

When an invocation for a collector repeatedly fails for a period longer than the lifetime of an SQS message, 
the collection state stored in that message is permanently lost. As a result, collection effectively stops 
for that stream. Should this issue occur across all streams in the collector, such as a bad credential or OOM,
then all collection for the collector ceases, and only healthchecks are left. 

## Solution

Implement a script that is run periodically that shall check if collection has ceased for a given collector by 
checking against the collector state database to ensure that collection has occured recently.

### PawsCollectorStates DDB Schema Rework

In order to accomplish this, the PawsCollectorStates Table shall need to be reworked so that there is 
stream level granularity within the DDB. To illustrate this point, below is the current schema:

| CollectorId(PK) | MessageId (SK) | CID | ExpireDate(TTL) | Status | Updated |
| ----------- | ----------- | ----------- | ----------- | ----------- | ----------- |
|  F976AEE4-F24F-45FC-9AF6-DABAE2D83EAE | 0000112c06ea10379ced2dffdfab9608 | 134265762 | 1611836604 | COMPLETE | 1610627006 | 

Currently, we only ensure that we do not receive the same message twice, though this unfortunately provides
no info regarding what stream was collected. 

The proposed schema is as follows:

| CollectorId(PK) | stream (SK) | CID | CollectionDate | ExpireDate(TTL) | Status | Updated |
| ----------- | ----------- | ----------- | ----------- | ----------- | ----------- |
|  F976AEE4-F24F-45FC-9AF6-DABAE2D83EAE | auth0 | 134265762 | 1611836604 | 1611836604 | 1610627006 | 

In this schema the following changes are made: 

 - `stream` is replaces `MessageId`, an identifier for the stream/object/log type being collected.
 - `CollectionDate` field is added, this notes the latest Log collected by the collector, for example
a collector that has retrieved messages from 18/01/2020T00:00:00Z till 19/01/2020T00:00:00Z shall store the
unix time representation of the latter date
 
Any checks performed by the collector shall be done on a per stream basis, and shall validate that the 
`since` field stored in their collector state is greater than the `CollectionDate`.

By using `stream` as our sort key, we reduce the potential number of items within our table drastically, as only 
one state is maintained per stream. Additionally, this prevents occurences of multiple instances of a stream being 
run concurrently as noted in previous cases where duplicate collection was occurring for a single stream.

Note for collectors that have no concept of objects or multiple streams, the collector type shall suffice as the stream value.

### Normalise Collector States and Lambda Env Vars

To implement this stream aware state storage, we shall need to normalise the following fields in the `privCollectorState` objects
within each collector:

- stream - multiple collectors use different names when describing a given object stream, i.e. salesforce uses objects, carbon black uses apiNames etc.
- since/until - must verify that each collector uses the same date/time format when storing their `since`/`until` fields in private collector state. If 
there are differences, we should align these and make any necessary transformations within the implementation of each paws collector
- process.env.collector_streams - multiple collectors use different environment variables when storing the enabled streams for the collector (usually either paws_param_string_1/2), 
proposal includes modifying the cloudformation templates and collector code to use a common `collector_streams` env variable that shows which streams are active for the collector. 
Again using collector_type or some other default value when the collector doesn't use individual streams for collection, i.e. 'auth0'  for auth0 collector

One downside to this is when implementing such changes, we'll need to run intermittent messy code to accept both values and transform appropriately to allow existing collectors
to be made in line with these changes. 

### Collection State Health Check

Once set up, in addition to any maintenance scripts we wish to maintain, we can additionally add a health check that can now query this ddb table like so:

```javascript

const AWS = require('aws-sdk');
const moment = require('moment');

function checkStreamsState(callback) {
    const collector = this;
    const streams = process.env.collector_streams
    const DDB = new AWS.DynamoDB();

    // Maybe we can do something smarter involving poll interval here...
    const thirtyMinutesAgo = moment().subtract(30, 'minutes').unix().toString();

    const params = {
        TableName: "PawsCollectorStreamStates",
        ConsistentRead: true,
        KeyConditionExpression: "CollectorId = :collectorId",
        ExpressionAttributeValues: {
            ":collectorId": {S: collector._collectorId},
        },
    }

    const queryStreamStatesPromise = DDB.query(params).promise();

    queryStreamStatesPromise.then((data => {
        let streamMap = {};
        
        data.Items.forEach(item => {
            streamMap[item["Stream"]] = item["CollectionDate"]
        });
        
        streams.forEach(stream => {
            let lastCollectionTs = streamMap[stream] | process.env.collection_start_ts;
            if (lastCollectionTs < thirtyMinutesAgo) {
                // pseudocode but you get the idea
                initState(stream, lastCollectionTs)
            }
        })

    })).catch(callback);
}

``` 
