process.env.AWS_REGION = 'us-east-1';
process.env.al_api = 'api.global-services.global.alertlogic.com';
process.env.ingest_api = 'ingest.global-services.global.alertlogic.com';
process.env.azollect_api = 'azcollect.global-services.global.alertlogic.com';
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

module.exports = {
    AIMS_TEST_CREDS: AIMS_TEST_CREDS,
    FUNCTION_ARN: FUNCTION_ARN,
    FUNCTION_NAME: FUNCTION_NAME,
    LOG_EVENT: LOG_EVENT
};
