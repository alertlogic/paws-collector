process.env.AWS_REGION = 'us-east-1';
process.env.al_api = 'api.global-services.global.alertlogic.com';
process.env.ingest_api = 'ingest.global-services.global.alertlogic.com';
process.env.azcollect_api = 'azcollect.global-services.global.alertlogic.com';
process.env.collector_status_api = 'collector_status.global-services.global.alertlogic.com';
process.env.aims_access_key_id = 'aims-key-id';
process.env.aims_secret_key = 'aims-secret-key-encrypted';
process.env.log_group = 'logGroupName';
process.env.paws_state_queue_arn = "arn:aws:sqs:us-east-1:352283894008:paws-state-queue";
process.env.paws_extension = 'ciscoduo';
process.env.ciscoduo_endpoint = 'https://test.alertlogic.com/';
process.env.ciscoduo_token = 'ciscoduo-token';
process.env.collector_id = 'collector-id';
process.env.al_application_id = 'application_id';
process.env.paws_secret_param_name = "ciscoduo-param-name";
process.env.paws_poll_interval = 60;
process.env.paws_type_name = "ciscoduo";
process.env.paws_api_secret = "secret";
process.env.paws_endpoint = "ciscoduo.com";
process.env.collector_streams = "[\"Authentication\", \"Administrator\",\"Telephony\", \"OfflineEnrollment\"]";
process.env.paws_api_client_id = "client-id";
process.env.paws_poll_interval_delay = 300;

const AIMS_TEST_CREDS = {
    access_key_id: 'test-access-key-id',
    secret_key: 'test-secret-key'
};

const LOG_EVENT = {
    access_device:
    {
        browser: 'Unknown',
        browser_version: '11.0',
        flash_version: null,
        hostname: null,
        ip: '0.0.0.0',
        java_version: null,
        location: [Object],
        os: 'Windows',
        os_version: '7'
    },
    alias: '',
    application: { key: 'qweqwewqeqw', name: 'portal' },
    auth_device: { ip: null, location: [Object], name: null },
    email: 'demo@demo.com',
    event_type: 'authentication',
    factor: null,
    isotimestamp: '2020-06-03T14:29:17.668359+00:00',
    reason: 'bypass_user',
    result: 'success',
    timestamp: 1591194557,
    trusted_endpoint_status: 'unknown',
    txid: 'qwewqewq-23123-adasd-123112d-12323qd',
    user: { key: 'qweqwewqeqw', name: 'testuser' }
};

const FUNCTION_ARN = 'arn:aws:lambda:us-east-1:352283894008:function:test-01-CollectLambdaFunction-2CWNLPPW5XO8';
const FUNCTION_NAME = 'test-TestCollectLambdaFunction-1JNNKQIPOTEST';

// Activity log event for Administrator stream (non-offline action)
const ACTIVITY_LOG_ADMIN = {
    action: { details: null, name: 'admin_update' },
    activity_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    actor: { key: 'DUABC123', name: 'admin', type: 'admin' },
    ts: '2024-01-01T12:00:00.000000+00:00'
};

// Activity log event for OfflineEnrollment stream (o2fa_ action)
const ACTIVITY_LOG_OFFLINE = {
    action: { details: null, name: 'o2fa_user_provisioned' },
    activity_id: 'ffffffff-gggg-hhhh-iiii-jjjjjjjjjjjj',
    actor: { key: 'DUBCD456', name: 'user1', type: 'user' },
    ts: '2024-01-01T12:01:00.000000+00:00'
};

// Telephony log event (v2 /admin/v2/logs/telephony)
const TELEPHONY_LOG = {
    context: 'authentication',
    credits: 1,
    phone: '+12125556707',
    telephony_id: '220f89ff-bff8-4466-b6cb-b7787940ce68',
    ts: '2024-01-01T12:02:00.000000+00:00',
    txid: '2f5d34d3-053f-422c-9dd4-77a5d58706b1',
    type: 'sms'
};

module.exports = {
    AIMS_TEST_CREDS: AIMS_TEST_CREDS,
    FUNCTION_ARN: FUNCTION_ARN,
    FUNCTION_NAME: FUNCTION_NAME,
    LOG_EVENT: LOG_EVENT,
    ACTIVITY_LOG_ADMIN: ACTIVITY_LOG_ADMIN,
    ACTIVITY_LOG_OFFLINE: ACTIVITY_LOG_OFFLINE,
    TELEPHONY_LOG: TELEPHONY_LOG
};
