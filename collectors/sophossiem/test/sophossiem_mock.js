process.env.AWS_REGION = 'us-east-1';
process.env.al_api = 'api.global-services.global.alertlogic.com';
process.env.ingest_api = 'ingest.global-services.global.alertlogic.com';
process.env.azollect_api = 'azcollect.global-services.global.alertlogic.com';
process.env.aims_access_key_id = 'aims-key-id';
process.env.aims_secret_key = 'aims-secret-key-encrypted';
process.env.log_group = 'logGroupName';
process.env.paws_state_queue_arn = "arn:aws:sqs:us-east-1:352283894008:paws-state-queue";
process.env.paws_extension = 'sophossiem';
process.env.sophossiem_endpoint = 'https://test.alertlogic.com/';
process.env.sophossiem_token = 'sophossiem-token';
process.env.collector_id = 'collector-id';
process.env.al_application_id = 'application_id';
process.env.paws_secret_param_name = "sophossiem-param-name";
process.env.paws_poll_interval = 60;
process.env.paws_type_name = "sophossiem";
process.env.paws_api_secret = "secret";
process.env.paws_endpoint = "https://sophossiem.com";
process.env.paws_api_client_id = "client-id";
process.env.collector_streams = "[\"Events\", \"Alerts\"]";
process.env.AWS_LAMBDA_FUNCTION_NAME = "test";

const AIMS_TEST_CREDS = {
    access_key_id: 'test-access-key-id',
    secret_key: 'test-secret-key'
};

const LOG_EVENT = {
    when: '2020-07-24T02:27:40.412Z',
    appSha256: null,
    appCerts: null,
    user_id: null,
    customer_id: 'qweqqwe-qweqwe-qweqw-qweqwe-qweweqwe',
    severity: 'low',
    created_at: '2020-07-24T02:27:40.426Z',
    source_info: [Object],
    threat: null,
    endpoint_id: 'qwewqwZX-weqwe-qweq-qwewe-qweqweqw',
    endpoint_type: 'server',
    origin: null,
    core_remedy_items: null,
    name:
        'Reboot to complete update; computer stays protected in the meantime',
    location: 'BI-WEB-01',
    id: 'fdf2r-werwe-wrew-werew-qrewrwerwer',
    type: 'Event::Endpoint::UpdateRebootRequired',
    source: 'n/a',
    group: 'UPDATING'
};

const FUNCTION_ARN = 'arn:aws:lambda:us-east-1:352283894008:function:test-01-CollectLambdaFunction-2CWNLPPW5XO8';
const FUNCTION_NAME = 'test-TestCollectLambdaFunction-1JNNKQIPOTEST';

module.exports = {
    AIMS_TEST_CREDS: AIMS_TEST_CREDS,
    FUNCTION_ARN: FUNCTION_ARN,
    FUNCTION_NAME: FUNCTION_NAME,
    LOG_EVENT: LOG_EVENT
};
