# Fix Collection States Proposal

## Problem

When an invocation for a collector repeatedly fails for a period longer than the lifetime of an SQS message, 
the collection state stored in that message is permanently lost. As a result, collection effectively stops 
for that stream. Should this issue occur across all streams in the collector, such as a bad credential or OOM,
then all collection for the collector ceases, and only healthchecks are left. 

## Solution

Implement a health check that is run periodically that shall check if collection has ceased for a given collector by 
checking against an updated collector state database to ensure that collection has occured recently for every stream.

### PawsCollectorStates DDB 

In order to achieve this the following changes shall need to be made to the PawsCollectorStates DDB:

| CollectorId(PK) | MessageId (SK) | CID | ExpireDate(TTL) | Updated | stream |
| ----------- | ----------- | ----------- | ----------- | ----------- | ----------- | ----------- |
|  F976AEE4-F24F-45FC-9AF6-DABAE2D83EAE | 0aef1023d9 | 134265762 | 1611836604 | 1610627006 | auth0 |

In this schema the following changes are made: 

- `stream` - stream has been added to give a some context around which stream the collection attempt has been made for  
 
Using the `stream` field, we can ensure that all the required streams for a collector are still collecting. Note for collectors that have no concept of objects or multiple streams, the collector type shall suffice as the stream value.

### Normalise Collector States and Lambda Env Vars

To implement this stream aware state storage, we shall need to normalise the following fields in the `privCollectorState` objects
within each collector:

- stream - multiple collectors use different names when describing a given object stream, i.e. salesforce uses objects, carbon black uses apiNames etc.
- process.env.collector_streams - multiple collectors use different environment variables when storing the enabled streams for the collector (usually either paws_param_string_1/2), 
proposal includes modifying the cloudformation templates and collector code to use a common `collector_streams` env variable that shows which streams are active for the collector. 
Again using collector_type or some other default value when the collector doesn't use individual streams for collection, i.e. 'auth0'  for auth0 collector

One downside to this is when implementing such changes, we'll need to run intermittent messy code to accept both values and transform appropriately to allow existing collectors
to be made in line with these changes. 
