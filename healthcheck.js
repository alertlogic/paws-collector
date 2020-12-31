const AWS = require('aws-sdk');
const moment = require('moment');

function checkLastState(callback){
    const collector = this;
    const DDB = new AWS.DynamoDB();
    const thirtyMinutesAgo = moment().subtract(30, 'minutes').unix().toString();

    const params = {
        Select: "COUNT",
        ExpressionAttributeValues: {
            ":collectorId": {S: collector._collectorId},
            ":thirtyMinutesAgo": {N: thirtyMinutesAgo}
        }, 
        KeyConditionExpression: "CollectorId = :collectorId",
        TableName: this._pawsDdbTableName,
        ConsistentRead: true,
        FilterExpression: `#updated >= :thirtyMinutesAgo`,
        ExpressionAttributeNames: {
            "#updated": "Updated"
        }
    };

    const getRecentStatesPromise = DDB.query(params).promise();

    getRecentStatesPromise.then(data => {
        // check to see if there are any states updated in themlast 30 mintues
        // this checks updated, not completed. we just want to see that the collector is still processing states
        if (data.Count > 0) {
            return callback(null, "collector has recently processed states");
        // otherwise, put a new item in ddb.
        } else {
            return callback("collector has not updated a state in 30 mins. Check collector state queue");
        }
        
    }).catch(callback);
}

module.exports = checkLastState;