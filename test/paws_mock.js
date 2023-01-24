process.env.AWS_REGION = 'us-east-1';
process.env.DD_API_KEY = 'a-dd-key';
process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function-name';
process.env.al_api = 'api.global-services.global.alertlogic.com';
process.env.ingest_api = 'ingest.global-services.global.alertlogic.com';
process.env.azollect_api = 'azcollect.global-services.global.alertlogic.com';
process.env.aims_access_key_id = 'aims-key-id';
process.env.aims_secret_key = 'aims-secret-key-encrypted';
process.env.log_group = 'logGroupName';
process.env.paws_state_queue_arn = 'arn:aws:sqs:us-east-1:352283894008:test-queue';
process.env.paws_state_queue_url = 'https://sqs.us-east-1.amazonaws.com/352283894008/test-queue';
process.env.paws_s3_object_path = "s3://joe-creds-test/paws_creds.json";
process.env.paws_kms_key_arn = "arn:aws:kms:us-east-1:352283894008:key/cdda86d5-615b-4dcc-9319-77ab34510473";
process.env.paws_type_name = 'okta';
process.env.paws_auth_type = 'auth';
process.env.paws_poll_interval = 900;
process.env.paws_endpoint = 'https://test.alertlogic.com/';
process.env.paws_api_secret = 'api-token';
process.env.collector_id = 'collector-id';
process.env.customer_id = '8675309';
process.env.paws_secret_param_name = 'PAWS-SECRET-paws';
process.env.paws_api_client_id = 'api-client-id';
process.env.al_application_id = 'paws';
process.env.paws_ddb_table_name = 'asampletable';
process.env.dl_s3_bucket_name = 'dl_s3_bucket';

const AIMS_TEST_CREDS = {
    access_key_id: 'test-access-key-id',
    secret_key: 'test-secret-key'
};

const PAWS_TEST_CREDS = {
    auth_type: process.env.paws_api_auth_type,
    client_id: process.env.paws_api_client_id,
    secret: process.env.paws_api_secret
};

const CWL_TEST_EVENT = {
    'awslogs' : { 
        'data' : 'H4sIAAAAAAAAAKWRQU8bQQyF/8poztmVPfZ4bG4RDRxQ1UrJrUJVIFu00iYb7W5AFeK/14AoQQIO7WE1M37W8/vW93HbjOP6pln93jfxJH6Zr+Y/vy6Wy/n5Is5if7drBi9TTklJjQHUy11/cz70h70r06Yf+8Om7arb/XX1q+vvKlfH56blNDTrrXc1u7YiIha44mrddS6Ph6vxemj3U9vvztpuaoYxnvyIb10un2wWt81uelTvY7t5TMPAppgzohlJIo9G2ZSLgoqXBbiwAipZToRZcxYpyadOrfNO661Hx5xEWbK7Acxe/oPbp3CMG46zByypJqwRauQU0FKN6E9mP11N9PyVQMEtwuuMl2vxtvnp6eL7Kny7iA+zt0hiPpaTghgjKVjJmAEweX4Wy05ralhUxItS6F0kAfhnJJM6OY0faB/y+IC/POUzHmVEML+acPGaZkmgyTT7vtBA1RdHAOIw5Cvi93nkP1aUU+1LIqpzPuZ5UsLrgA94Lh/+AE/QzKAiAwAA'
    }
};

const STACK_ID = 'arn:aws:cloudformation:us-east-1:352283894008:stack/test/87b3dc90-bd7e-11e7-9e43-503abe701cfd';
const FUNCTION_ARN = 'arn:aws:lambda:us-east-1:352283894008:function:test-01-CollectLambdaFunction-2CWNLPPW5XO8';
const FUNCTION_NAME = 'test-TestCollectLambdaFunction-1JNNKQIPOTEST';
const REGISTRATION_TEST_URL = '/aws/test/353333894008/us-east-1/' + encodeURIComponent(FUNCTION_NAME);
const STACK_NAME = 'test-stack-01';
const LOG_GROUP = 'username-logs-group';

const REGISTRATION_TEST_EVENT = {
    'RequestType': 'Create',
    'ServiceToken': FUNCTION_ARN,
    'ResponseURL': 'https://cloudformation-custom-resource-response-useast1.s3.amazonaws.com/resp',
    'StackId': 'arn:aws:cloudformation:us-east-1:352283894008:stack/test-stack-01/92605900',
    'RequestId': '255fe44d-af80-4c42-bf30-6a78aa244aad',
    'LogicalResourceId': 'RegistrationResource',
    'ResourceType': 'Custom::RegistrationResource',
    'ResourceProperties':
    {
        'ServiceToken': FUNCTION_ARN,
        'StackName': STACK_NAME,
        'AwsAccountId': '353333894008',
        'LogGroup': LOG_GROUP
    }
};

const REGISTRATION_PARAMS = {
    stackName : STACK_NAME,
    custom_fields: {
        log_groups : [LOG_GROUP]
    }
};

const DEREGISTRATION_TEST_EVENT = {
    'RequestType': 'Delete',
    'ServiceToken': FUNCTION_ARN,
    'ResponseURL': 'https://cloudformation-custom-resource-response-useast1.s3.amazonaws.com/resp',
    'StackId': 'arn:aws:cloudformation:us-east-1:352283894008:stack/test-stack-01/92605900',
    'RequestId': '255fe44d-af80-4c42-bf30-6a78aa244aad',
    'LogicalResourceId': 'RegistrationResource',
    'ResourceType': 'Custom::RegistrationResource',
    'ResourceProperties':
    {
        'ServiceToken': FUNCTION_ARN,
        'StackName': STACK_NAME,
        'AwsAccountId': '353333894008',
        'LogGroup': LOG_GROUP
    }
};

const DEREGISTRATION_PARAMS = REGISTRATION_PARAMS;

const CHECKIN_TEST_EVENT = {
    'RequestType': 'ScheduledEvent',
    'Type': 'Checkin',
    'AwsAccountId': '353333894008',
    'StackName' : STACK_NAME,
    'Region' : 'us-east-1'
};


const SELF_UPDATE_EVENT = {
    'RequestType': 'ScheduledEvent',
    'Type': 'SelfUpdate'
};

const HEALTCHECK_SUBSCRIPTION_FILTERS = {
    'subscriptionFilters': [
        {
            'filterName': 'vpc-flow-logs',
            'logGroupName': 'tdosoudil-vpc-flow-logs',
            'filterPattern': '',
            'destinationArn': FUNCTION_ARN,
            'distribution': 'ByLogStream',
            'creationTime': 1528359289712
        }
    ]
};

module.exports = {
    AIMS_TEST_CREDS : AIMS_TEST_CREDS,
    PAWS_TEST_CREDS : PAWS_TEST_CREDS,
    CWL_TEST_EVENT : CWL_TEST_EVENT,
    FUNCTION_ARN : FUNCTION_ARN,
    STACK_NAME : STACK_NAME,
    REGISTRATION_TEST_EVENT : REGISTRATION_TEST_EVENT,
    REGISTRATION_PARAMS : REGISTRATION_PARAMS,
    DEREGISTRATION_TEST_EVENT : DEREGISTRATION_TEST_EVENT,
    DEREGISTRATION_PARAMS : DEREGISTRATION_PARAMS,
    CHECKIN_TEST_EVENT : CHECKIN_TEST_EVENT,
    SELF_UPDATE_EVENT : SELF_UPDATE_EVENT,
    HEALTCHECK_SUBSCRIPTION_FILTERS : HEALTCHECK_SUBSCRIPTION_FILTERS,
    STACK_ID : STACK_ID,
    REGISTRATION_TEST_URL : REGISTRATION_TEST_URL
};
