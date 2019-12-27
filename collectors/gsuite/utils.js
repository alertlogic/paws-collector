function  listLoginEvents(auth, params, callback) {
    const service = google.admin({version: 'reports_v1', auth});
    params['userKey'] = 'all';
    params['applicationName'] = 'login';
    service.activities.list(params, (err, res) => {
        if (!('items' in res.data)){
            console.log(res);
            return Error('No more logs');
        }
        if (err) return callback(null, err);
        return callback(res.data.items);
   });
}