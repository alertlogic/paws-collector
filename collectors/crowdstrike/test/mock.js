process.env.AWS_REGION = 'us-east-1';
process.env.al_api = 'api.global-services.global.alertlogic.com';
process.env.ingest_api = 'ingest.global-services.global.alertlogic.com';
process.env.azollect_api = 'azcollect.global-services.global.alertlogic.com';
process.env.aims_access_key_id = 'aims-key-id';
process.env.aims_secret_key = 'aims-secret-key-encrypted';
process.env.log_group = 'logGroupName';
process.env.paws_state_queue_arn = "arn:aws:sqs:us-east-1:352283894008:paws-state-queue";
process.env.paws_extension = 'crowdstrike';
process.env.crowdstrike_endpoint = 'https://test.alertlogic.com/';
process.env.crowdstrike_token = 'crowdstrike-token';
process.env.collector_id = 'collector-id';
process.env.al_application_id = 'application_id';

const AIMS_TEST_CREDS = {
    access_key_id: 'test-access-key-id',
    secret_key: 'test-secret-key'
};

const LOG_EVENT = {
    // Here is where you fill in you mock log event
    };

const FUNCTION_ARN = 'arn:aws:lambda:us-east-1:352283894008:function:test-01-CollectLambdaFunction-2CWNLPPW5XO8';
const FUNCTION_NAME = 'test-TestCollectLambdaFunction-1JNNKQIPOTEST';

module.exports = {
    AIMS_TEST_CREDS: AIMS_TEST_CREDS,
    FUNCTION_ARN: FUNCTION_ARN,
    FUNCTION_NAME: FUNCTION_NAME,
    LOG_EVENT: LOG_EVENT
};
