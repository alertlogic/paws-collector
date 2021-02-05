process.env.AWS_REGION = 'us-east-1';
process.env.al_api = 'api.global-services.global.alertlogic.com';
process.env.ingest_api = 'ingest.global-services.global.alertlogic.com';
process.env.azollect_api = 'azcollect.global-services.global.alertlogic.com';
process.env.aims_access_key_id = 'aims-key-id';
process.env.aims_secret_key = 'aims-secret-key-encrypted';
process.env.log_group = 'logGroupName';
process.env.paws_state_queue_arn = "arn:aws:sqs:us-east-1:352283894008:paws-state-queue";
process.env.paws_extension = 'ciscoamp';
process.env.ciscoamp_endpoint = 'https://test.alertlogic.com/';
process.env.ciscoamp_token = 'ciscoamp-token';
process.env.collector_id = 'collector-id';
process.env.al_application_id = 'application_id';
process.env.paws_secret_param_name = "ciscoamp-param-name";
process.env.paws_poll_interval = 60;
process.env.paws_type_name = "ciscoamp";
process.env.paws_api_secret = "secret";
process.env.paws_api_client_id = "client_id";
process.env.paws_endpoint = "https://ciscoamp.com";
process.env.collector_streams = "[\"AuditLogs\",\"Events\"]";
process.env.AWS_LAMBDA_FUNCTION_NAME = "test";

const AIMS_TEST_CREDS = {
    access_key_id: 'test-access-key-id',
    secret_key: 'test-secret-key'
};

const LOG_EVENT = {
    event: 'create',
    audit_log_type: 'Computer',
    audit_log_id: 'b72fd5c0-1ec8-4b7a-b5aa-a500e64635f4',
    audit_log_user: '16db5cf986eec6f44422',
    created_at: '2020-04-20T05:30:18Z',
    old_attributes:
    {
        name: null,
        desc: null,
        hostname: null,
        group_id: null,
        operating_system_id: null
    },
    new_attributes:
    {
        name: 'Demo_AMP_Intel',
        desc: 'Computer populated with demo data',
        hostname: 'Demo_AMP_Intel',
        group_id: 609190,
        operating_system_id: 21810
    }
};



const FUNCTION_ARN = 'arn:aws:lambda:us-east-1:352283894008:function:test-01-CollectLambdaFunction-2CWNLPPW5XO8';
const FUNCTION_NAME = 'test-TestCollectLambdaFunction-1JNNKQIPOTEST';

module.exports = {
    AIMS_TEST_CREDS: AIMS_TEST_CREDS,
    FUNCTION_ARN: FUNCTION_ARN,
    FUNCTION_NAME: FUNCTION_NAME,
    LOG_EVENT: LOG_EVENT
};
