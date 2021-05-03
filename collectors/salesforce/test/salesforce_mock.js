process.env.AWS_REGION = 'us-east-1';
process.env.al_api = 'api.global-services.global.alertlogic.com';
process.env.ingest_api = 'ingest.global-services.global.alertlogic.com';
process.env.azollect_api = 'azcollect.global-services.global.alertlogic.com';
process.env.aims_access_key_id = 'aims-key-id';
process.env.aims_secret_key = 'aims-secret-key-encrypted';
process.env.log_group = 'logGroupName';
process.env.paws_state_queue_arn = "arn:aws:sqs:us-east-1:352283894008:paws-state-queue";
process.env.paws_extension = 'salesforce';
process.env.salesforce_endpoint = 'https://test.alertlogic.com/';
process.env.salesforce_token = 'salesforce-token';
process.env.collector_id = 'collector-id';
process.env.al_application_id = 'salesforce';
process.env.paws_secret_param_name = "salesforce-param-name";
process.env.paws_poll_interval = 60;
process.env.paws_type_name = "salesforce";
process.env.paws_collector_param_string_1 = "salesforceUserID";
process.env.paws_api_secret = 'paws-secret-key-encrypted';
process.env.collector_streams = "[\"LoginHistory\", \"EventLogFile\",\"ApiEvent\", \"LoginEvent\", \"LogoutEvent\", \"LoginAsEvent\"]";
process.env.paws_endpoint = "login.salesforce.com";
process.env.AWS_LAMBDA_FUNCTION_NAME = "test";

const AIMS_TEST_CREDS = {
    access_key_id: 'test-access-key-id',
    secret_key: 'test-secret-key'
};

const LOG_EVENT = {
    attributes:
    {
        type: 'User',
        url: '/services/data/v42.0/sobjects/User/00550000006zWUdAAM'
    },
    Id: '00550000006zWUdAAM',
    Name: 'Darrin Pryor',
    LastLoginDate: '2020-01-27T15:22:54.000+0000'
};



const FUNCTION_ARN = 'arn:aws:lambda:us-east-1:352283894008:function:test-01-CollectLambdaFunction-2CWNLPPW5XO8';
const FUNCTION_NAME = 'test-TestCollectLambdaFunction-1JNNKQIPOTEST';

module.exports = {
    AIMS_TEST_CREDS: AIMS_TEST_CREDS,
    FUNCTION_ARN: FUNCTION_ARN,
    FUNCTION_NAME: FUNCTION_NAME,
    LOG_EVENT: LOG_EVENT
};
