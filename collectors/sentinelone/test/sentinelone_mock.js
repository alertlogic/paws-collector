process.env.AWS_REGION = 'us-east-1';
process.env.al_api = 'api.global-services.global.alertlogic.com';
process.env.ingest_api = 'ingest.global-services.global.alertlogic.com';
process.env.azollect_api = 'azcollect.global-services.global.alertlogic.com';
process.env.aims_access_key_id = 'aims-key-id';
process.env.aims_secret_key = 'aims-secret-key-encrypted';
process.env.log_group = 'logGroupName';
process.env.paws_state_queue_arn = "arn:aws:sqs:us-east-1:352283894008:paws-state-queue";
process.env.paws_extension = 'sentinelone';
process.env.sentinelone_endpoint = 'https://test.alertlogic.com/';
process.env.sentinelone_token = 'sentinelone-token';
process.env.collector_id = 'collector-id';
process.env.al_application_id = 'application_id';
process.env.paws_secret_param_name = "sentinelone-param-name";
process.env.paws_poll_interval = 60;
process.env.paws_type_name = "sentinelone";
process.env.paws_api_secret = "secret";
process.env.paws_endpoint = "https://sentinelone.com";
process.env.paws_poll_interval_delay = 300;

const AIMS_TEST_CREDS = {
    access_key_id: 'test-access-key-id',
    secret_key: 'test-secret-key'
};

const LOG_EVENT = {
    accountId: '23231231231',
    activityType: 2112,
    agentId: null,
    agentUpdatedVersion: null,
    comments: null,
    createdAt: '2020-04-01T10:26:45.832982Z',
    data:
    {
        role: 'admin',
        source: 'mgmt',
        userScope: 'site',
        username: 'XXX ZZZ'
    },
    description: null,
    groupId: null,
    hash: null,
    id: '21213313131',
    osFamily: null,
    primaryDescription:
        'The management user logged into the management console.',
    secondaryDescription: null,
    siteId: '23231231231',
    threatId: null,
    updatedAt: '2020-04-01T10:26:45.827968Z',
    userId: '21213313131'
};

const FUNCTION_ARN = 'arn:aws:lambda:us-east-1:352283894008:function:test-01-CollectLambdaFunction-2CWNLPPW5XO8';
const FUNCTION_NAME = 'test-TestCollectLambdaFunction-1JNNKQIPOTEST';

module.exports = {
    AIMS_TEST_CREDS: AIMS_TEST_CREDS,
    FUNCTION_ARN: FUNCTION_ARN,
    FUNCTION_NAME: FUNCTION_NAME,
    LOG_EVENT: LOG_EVENT
};
