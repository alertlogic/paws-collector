process.env.AWS_REGION = 'us-east-1';
process.env.al_api = 'api.global-services.global.alertlogic.com';
process.env.ingest_api = 'ingest.global-services.global.alertlogic.com';
process.env.azollect_api = 'azcollect.global-services.global.alertlogic.com';
process.env.aims_access_key_id = 'aims-key-id';
process.env.aims_secret_key = 'aims-secret-key-encrypted';
process.env.log_group = 'logGroupName';
process.env.paws_state_queue_arn = "arn:aws:sqs:us-east-1:352283894008:paws-state-queue";
process.env.paws_extension = 'carbonblack';
process.env.carbonblack_endpoint = 'https://test.alertlogic.com/';
process.env.carbonblack_token = 'carbonblack-token';
process.env.collector_id = 'collector-id';
process.env.al_application_id = 'carbonblack';
process.env.paws_secret_param_name = "carbonblack-param-name";
process.env.paws_poll_interval = 60;
process.env.paws_type_name = "carbonblack";
process.env.paws_api_client_id = "client-id";
process.env.paws_api_secret = "api-secret";
process.env.collector_streams = "[\"AuditLogEvents\", \"SearchAlerts\",\"SearchAlertsCBAnalytics\", \"SearchAlertsVmware\", \"SearchAlertsWatchlist\"]";
process.env.paws_collector_param_string_2 = "carbonblackOrgKey";
process.env.paws_endpoint = "https://api-url.conferdeploy.net";

const AIMS_TEST_CREDS = {
    access_key_id: 'test-access-key-id',
    secret_key: 'test-secret-key'
};

const LOG_EVENT =  {
    "requestUrl": null,
    "eventTime": 1529332687006,
    "eventId": "37075c01730511e89504c9ba022c3fbf",
    "loginName": "bs@carbonblack.com",
    "orgName": "example.org",
    "flagged": false,
    "clientIp": "192.0.2.3",
    "verbose": false,
    "description": "Logged in successfully"
};

const FUNCTION_ARN = 'arn:aws:lambda:us-east-1:352283894008:function:test-01-CollectLambdaFunction-2CWNLPPW5XO8';
const FUNCTION_NAME = 'test-TestCollectLambdaFunction-1JNNKQIPOTEST';

module.exports = {
    AIMS_TEST_CREDS: AIMS_TEST_CREDS,
    FUNCTION_ARN: FUNCTION_ARN,
    FUNCTION_NAME: FUNCTION_NAME,
    LOG_EVENT: LOG_EVENT
};
