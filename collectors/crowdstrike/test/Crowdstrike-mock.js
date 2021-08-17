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
process.env.al_application_id = 'crowdstrike';
process.env.paws_secret_param_name = "crowdstrike-param-name";
process.env.paws_poll_interval = 60;
process.env.paws_type_name = "crowdstrike";
process.env.paws_api_client_id = "client-id";
process.env.paws_api_secret = "client-secret";
process.env.collector_streams = "[\"Incident\", \"Detection\"]";
process.env.paws_endpoint = "https://api.crowdstrike.com";

const AIMS_TEST_CREDS = {
    access_key_id: 'test-access-key-id',
    secret_key: 'test-secret-key'
};

const AUTHENTICATE = {
    "access_token": "test_token",
    "expires_in": 1799,
    "token_type": "bearer"
};

const LIST = {
    "meta" : {
        "query_time" : 0.01414002,
        "pagination" : {
            "offset" : 0,
            "limit" : 100,
            "total" : 3184
        },
        "powered_by" : "msa-api",
        "trace_id" : "d4d3158c-731c-4cb6-97ed-8b999f65fedf"
    },
    "resources" : ['ldt:4c3db6145a704a179a6dacd924f6e8cc:73087931424', 'ldt:4c3db6145a704a179a6dacd924f6e8cc:73087626831'],
    "errors" : []
};

const DETECTION_LOG_EVENT = {
    "meta" : {
        "query_time" : 0.01414002,
        "powered_by" : "msa-api",
        "trace_id" : "d4d3158c-731c-4cb6-97ed-8b999f65fedf"
    },
    "resources" : [
        {
            "detection_id":"ldt:4c3db6145a704a179a6dacd924f6e8cc:73087931424",
            "created_timestamp":"2021-08-13T07:20:20.77857433Z",
            "first_behavior":"2021-08-13T07:20:08Z",
            "last_behavior":"2021-08-13T07:20:16Z",
            "max_confidence":100,
            "max_severity":70,
            "max_severity_displayname":"High",
            "show_in_ui":true,
            "status":"new"
        }
    ],
    "errors" : []
};

const INCIDENT_LOG_EVENT = {
    "meta" : {
        "query_time" : 0.01414002,
        "powered_by" : "msa-api",
        "trace_id" : "d4d3158c-731c-4cb6-97ed-8b999f65fedf"
    },
    "resources" : [
        {
            "incident_id":"inc:3fd9b8a8a7ba426a9bf3aaa2ddfc5b02:36f66221fa044c74a9e3ffa5ba8ab2d3",
            "incident_type":1,
            "created":"2021-06-09T14:53:05Z",
            "start":"2021-06-09T14:53:05Z",
            "end":"2021-06-09T14:53:05Z",
            "state":"closed",
            "status":20
        }
    ],
    "errors" : []
};

const FUNCTION_ARN = 'arn:aws:lambda:us-east-1:352283894008:function:test-01-CollectLambdaFunction-2CWNLPPW5XO8';
const FUNCTION_NAME = 'test-TestCollectLambdaFunction-1JNNKQIPOTEST';

module.exports = {
    AIMS_TEST_CREDS: AIMS_TEST_CREDS,
    FUNCTION_ARN: FUNCTION_ARN,
    FUNCTION_NAME: FUNCTION_NAME,
    DETECTION_LOG_EVENT: DETECTION_LOG_EVENT,
    INCIDENT_LOG_EVENT: INCIDENT_LOG_EVENT,
    LIST: LIST,
    AUTHENTICATE: AUTHENTICATE
};
