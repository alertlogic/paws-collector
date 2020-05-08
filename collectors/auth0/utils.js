function getAPILogs(auth0Client, state, accumulator, maxPagesPerInvocation) {
    let pageCount = 0;

    let params = state.last_log_id ? { from: state.last_log_id } : { q: "date=[" + state.since + " TO *]", sort: "date:1" };
    let nextLogId = state.last_log_id ? state.last_log_id : null;
    let lastLogTs = null;

    return new Promise(function (resolve, reject) {
        getData(params);
        function getData(params) {
            if (pageCount < maxPagesPerInvocation) {
                return auth0Client
                    .getLogs(params)
                    .then(function (logAcc) {
                        pageCount++;
                        if (logAcc.length > 0) {
                            accumulator.push(...logAcc);
                            nextLogId = logAcc[logAcc.length - 1].log_id;
                            lastLogTs = logAcc[logAcc.length - 1].date;
                            params = { from: nextLogId };
                            getData(params);
                        }
                        else {
                            resolve({ accumulator, nextLogId, lastLogTs });
                        }
                    })
                    .catch(function (err) {
                        reject(err);
                    });
            }
            else {
                resolve({ accumulator, nextLogId, lastLogTs });
            }
        }
    });
}

module.exports = {
    getAPILogs: getAPILogs
};
