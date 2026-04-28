process.env.AWS_REGION = 'us-east-1';
process.env.al_api = 'api.global-services.global.alertlogic.com';
process.env.ingest_api = 'ingest.global-services.global.alertlogic.com';
process.env.azcollect_api = 'azcollect.global-services.global.alertlogic.com';
process.env.collector_status_api = 'collector_status.global-services.global.alertlogic.com';
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
process.env.collector_streams = "[\"Alerts\"]";
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

const ALERTS_LOG_EVENT = {
    "meta": {
        "query_time": 0.01414002,
        "powered_by": "msa-api",
        "trace_id": "d4d3158c-731c-4cb6-97ed-8b999f65fedf"
    },
    "resources": [
        {
            "agent_id": "36f66221fa044c74a9e3ffa5ba8ab2d3",
            "aggregate_id": "806b5e44b7bce1006b1704c86c42f6f3813367dca081ba24ed1572",
            "composite_id": "fa23ab2e36fc4d12930f404ce0070d52:ind:36f66221fa044c74a9e3ffa5ba8ab2d3:4369786211892-10335-11200272",
            "context_timestamp": "2025-08-17T15:31:37.962Z",
            "crawled_timestamp": "2025-08-17T16:31:41.180070674Z",
            "created_timestamp": "2025-08-17T15:32:41.196001085Z",
            "show_in_ui": false,
            "confidence": 80,
            "severity": 70,
            "severity_name": "High",
            "status": "new",
            "product": "epp"
        },
        {
            "agent_id": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
            "aggregate_id": "9c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f",
            "composite_id": "ab12cd34ef56ab78cd90ef12:ind:a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6:5480897322003-20446-22311383",
            "context_timestamp": "2025-08-17T16:15:00.000Z",
            "crawled_timestamp": "2025-08-17T17:15:03.456789012Z",
            "created_timestamp": "2025-08-17T16:16:00.000000000Z",
            "show_in_ui": true,
            "confidence": 90,
            "severity": 80,
            "severity_name": "Critical",
            "status": "new",
            "product": "automated-lead"
        },
        {
            "agent_id": "f1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6",
            "aggregate_id": "3f4e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b0a1f2e",
            "composite_id": "cd34ef56ab78cd90ef12ab34:ind:f1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6:6591908433114-31557-33422494",
            "context_timestamp": "2025-08-17T17:00:00.000Z",
            "crawled_timestamp": "2025-08-17T18:00:05.789012345Z",
            "created_timestamp": "2025-08-17T17:01:00.000000000Z",
            "show_in_ui": true,
            "confidence": 70,
            "severity": 60,
            "severity_name": "Medium",
            "status": "in_progress",
            "product": "thirdparty"
        }
    ],
    "errors": []
};


const FUNCTION_ARN = 'arn:aws:lambda:us-east-1:352283894008:function:test-01-CollectLambdaFunction-2CWNLPPW5XO8';
const FUNCTION_NAME = 'test-TestCollectLambdaFunction-1JNNKQIPOTEST';

module.exports = {
    AIMS_TEST_CREDS: AIMS_TEST_CREDS,
    FUNCTION_ARN: FUNCTION_ARN,
    FUNCTION_NAME: FUNCTION_NAME,
    ALERTS_LOG_EVENT: ALERTS_LOG_EVENT,
    LIST: LIST,
    AUTHENTICATE: AUTHENTICATE
};
