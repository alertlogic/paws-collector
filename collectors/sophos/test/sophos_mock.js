process.env.AWS_REGION = 'us-east-1';
process.env.al_api = 'api.global-services.global.alertlogic.com';
process.env.ingest_api = 'ingest.global-services.global.alertlogic.com';
process.env.azollect_api = 'azcollect.global-services.global.alertlogic.com';
process.env.aims_access_key_id = 'aims-key-id';
process.env.aims_secret_key = 'aims-secret-key-encrypted';
process.env.log_group = 'logGroupName';
process.env.paws_state_queue_arn = "arn:aws:sqs:us-east-1:352283894008:paws-state-queue";
process.env.paws_extension = 'sophos';
process.env.sophos_endpoint = 'https://test.alertlogic.com/';
process.env.sophos_token = 'sophos-token';
process.env.collector_id = 'collector-id';
process.env.al_application_id = 'application_id';
process.env.paws_secret_param_name = "sophos-param-name";
process.env.paws_poll_interval = 60;
process.env.paws_type_name = "sophos";
process.env.paws_api_secret = "secret";
process.env.paws_endpoint = "sophos.com";
process.env.paws_api_client_id = "client-id";
process.env.AWS_LAMBDA_FUNCTION_NAME = "test";
process.env.paws_poll_interval_delay = 300;

const AIMS_TEST_CREDS = {
    access_key_id: 'test-access-key-id',
    secret_key: 'test-secret-key'
};

const LOG_EVENT = {
    "id": "1E623A9B-A54D-432A-A514-02FEDDC080B5",
    "description": "Controlled application blocked: Quake (Game)",
    "type": "Event::Endpoint::Application::Blocked",
    "groupKey": "APPLICATION_CONTROL",
    "severity": "medium",
    "category": "applicationControl",
    "product": "endpoint",
    "tenant": {
        "id": "26AE6B83-088F-4708-8103-BAA4E76B1048"
    },
    "managedAgent": {
        "id": "6B64BFA4-A773-487B-B44F-8D635609A79A",
        "type": "computer"
    },
    "person": {
        "id": "4CC323EE-6D93-4CC5-AD3E-7AF5DC3B1AB9"
    },
    "raisedAt": "2020-05-30T13:49:11.789012Z",
    "allowedActions": [
        "acknowledge",
        "authPua",
        "contactSupport"
    ]
};

const FUNCTION_ARN = 'arn:aws:lambda:us-east-1:352283894008:function:test-01-CollectLambdaFunction-2CWNLPPW5XO8';
const FUNCTION_NAME = 'test-TestCollectLambdaFunction-1JNNKQIPOTEST';

module.exports = {
    AIMS_TEST_CREDS: AIMS_TEST_CREDS,
    FUNCTION_ARN: FUNCTION_ARN,
    FUNCTION_NAME: FUNCTION_NAME,
    LOG_EVENT: LOG_EVENT
};
