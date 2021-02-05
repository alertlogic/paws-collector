process.env.AWS_REGION = 'us-east-1';
process.env.al_api = 'api.global-services.global.alertlogic.com';
process.env.ingest_api = 'ingest.global-services.global.alertlogic.com';
process.env.azollect_api = 'azcollect.global-services.global.alertlogic.com';
process.env.aims_access_key_id = 'aims-key-id';
process.env.aims_secret_key = 'aims-secret-key-encrypted';
process.env.paws_api_client_id = 'a-client-id';
process.env.paws_api_secret = 'paws-secret-key-encrypted';
process.env.log_group = 'logGroupName';
process.env.paws_state_queue_arn = "arn:aws:sqs:us-east-1:352283894008:paws-state-queue";
process.env.paws_secret_param_name =  "joe-o365-test-param";
process.env.paws_collector_param_string_1 = '79ca7c9d-83ce-498f-952f-4c03b56ab573';
process.env.collector_streams = '["Audit.AzureActiveDirectory", "Audit.Exchange", "Audit.SharePoint", "Audit.General"]';
process.env.paws_type_name = 'o365';
process.env.paws_endpoint = 'https://test.alertlogic.com/';
process.env.o365_token = 'o365-token';
process.env.collector_id = 'collector-id';
process.env.al_application_id = 'o365';
process.env.paws_poll_interval = 60;
process.env.paws_max_pages_per_invocation = 2;

const AIMS_TEST_CREDS = {
    access_key_id: 'test-access-key-id',
    secret_key: 'test-secret-key'
};

const LOG_EVENT = {
    CreationTime: new Date().toISOString(),
    RecordType: "MockRecordType"
};

const MOCK_LOG = {
    CreationTime: new Date().toISOString(),
    RecordType: "MockRecordType"
};

const FUNCTION_ARN = 'arn:aws:lambda:us-east-1:352283894008:function:test-01-CollectLambdaFunction-2CWNLPPW5XO8';
const FUNCTION_NAME = 'test-TestCollectLambdaFunction-1JNNKQIPOTEST';

module.exports = {
    AIMS_TEST_CREDS: AIMS_TEST_CREDS,
    FUNCTION_ARN: FUNCTION_ARN,
    FUNCTION_NAME: FUNCTION_NAME,
    LOG_EVENT: LOG_EVENT,
    MOCK_LOG: MOCK_LOG
};
