
const { google } = require('googleapis');

function  listEvents(auth, params, op ,callback) {
    const service = google.admin({version: 'reports_v1', auth});
    params['userKey'] = 'all';

    
    service.activities.list(params, (err, res) => {

        if (op.length == 0) {
            if (err){
              return callback(null, err);
            }
            if (!('items' in res.data)){
                return callback(null,Error('No more logs'));
            }
        }
        
        if('items' in res.data ){
           op.push(...res.data.items); 
        }
        
        if (!('nextPageToken' in res.data)){ 
            return callback(op);
        }

        params['pageToken'] = res.data.nextPageToken;
        
        listEvents(auth, params, op, callback);
    });
}


module.exports = {
    listEvents: listEvents
}
