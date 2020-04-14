const RestServiceClient = require('@alertlogic/al-collector-js').RestServiceClient;

const Audit_Logs = 'AuditLogs';
const Events = 'Events';

function getAPIDetails(state) {
    let url = "";

    switch (state.resource) {
        case Audit_Logs:
            url = `/v1/audit_logs`;
            break;
        case Events:
            url = `/v1/events`;
            break;
        default:
            url = null;
    }
    return {
        url
    };
}

module.exports = {
    getAPIDetails: getAPIDetails
};
