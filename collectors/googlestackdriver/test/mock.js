process.env.AWS_REGION = 'us-east-1';
process.env.al_api = 'api.global-services.global.alertlogic.com';
process.env.ingest_api = 'ingest.global-services.global.alertlogic.com';
process.env.azollect_api = 'azcollect.global-services.global.alertlogic.com';
process.env.aims_access_key_id = 'aims-key-id';
process.env.aims_secret_key = 'aims-secret-key-encrypted';
process.env.log_group = 'logGroupName';
process.env.paws_state_queue_arn = "arn:aws:sqs:us-east-1:352283894008:paws-state-queue";
process.env.paws_extension = 'googlestackdriver';
process.env.googlestackdriver_endpoint = 'https://test.alertlogic.com/';
process.env.googlestackdriver_token = 'googlestackdriver-token';
process.env.collector_streams = '["projects/joe-is-cool", "projects/boogabooga"]';
process.env.paws_secret_param_name = "google-driver-param-name";
process.env.al_application_id = 'googlestackdriver';
process.env.collector_id = 'collector-id';
process.env.paws_poll_interval = 60;
process.env.paws_max_pages_per_invocation = 2;
process.env.paws_endpoint = 'No-Endpoint';
process.env.paws_type_name = "googlestackdriver";
process.env.AWS_LAMBDA_FUNCTION_NAME = "test";


const AIMS_TEST_CREDS = {
    access_key_id: 'test-access-key-id',
    secret_key: 'test-secret-key'
};

const LOG_EVENT_JSON_PAYLOAD = { labels: {},
    insertId: '-qwnqhydhp96',
    httpRequest: null,
    resource: { labels: [Object], type: 'project' },
    timestamp: { seconds: '1577807973', nanos: 776000000 },
    severity: 'NOTICE',
    logName:
     'projects/joe-test-8675309/logs/cloudaudit.googleapis.com%2Factivity',
    operation: null,
    trace: '',
    sourceLocation: null,
    receiveTimestamp: { seconds: '1577807974', nanos: 105817306 },
    metadata: null,
    spanId: '',
    traceSampled: false,
    jsonPayload:{
        "fields": {
            "resource": {
                "structValue": {
                    "fields": {
                        "id": {
                            "stringValue": "7214092729133430404",
                            "kind": "stringValue"
                        },
                        "region": {
                            "stringValue": "asia-northeast3",
                            "kind": "stringValue"
                        },
                        "name": {
                            "stringValue": "default",
                            "kind": "stringValue"
                        },
                        "type": {
                            "stringValue": "subnetwork",
                            "kind": "stringValue"
                        }
                    }
                },
                "kind": "structValue"
            },
            "event_type": {
                "stringValue": "GCE_OPERATION_DONE",
                "kind": "stringValue"
            },
            "trace_id": {
                "stringValue": "operation-1579031101569-59c1ed3e5f8fe-e5a0bde3-b85c1f44",
                "kind": "stringValue"
            },
            "operation": {
                "structValue": {
                    "fields": {
                        "name": {
                            "stringValue": "operation-1579031101569-59c1ed3e5f8fe-e5a0bde3-b85c1f44",
                            "kind": "stringValue"
                        },
                        "type": {
                            "stringValue": "operation",
                            "kind": "stringValue"
                        },
                        "id": {
                            "stringValue": "192307605219288274",
                            "kind": "stringValue"
                        },
                        "region": {
                            "stringValue": "asia-northeast3",
                            "kind": "stringValue"
                        }
                    }
                },
                "kind": "structValue"
            },
            "event_subtype": {
                "stringValue": "compute.subnetworks.createOrUpdateVirtualSubnetwork",
                "kind": "stringValue"
            },
            "version": {
                "stringValue": "1.2",
                "kind": "stringValue"
            },
            "event_timestamp_us": {
                "stringValue": "1579031109043790",
                "kind": "stringValue"
            },
            "actor": {
                "structValue": {
                    "fields": {
                        "user": {
                            "stringValue": "",
                            "kind": "stringValue"
                        }
                    }
                },
                "kind": "structValue"
            }
        }
    },
    payload: 'jsonPayload' };

const LOG_EVENT_TEXT_PAYLOAD = { labels: {},
    insertId: '-qwnqhydhp96',
    httpRequest: null,
    resource: { labels: [Object], type: 'project' },
    timestamp: { seconds: '1577807973', nanos: 776000000 },
    severity: 'NOTICE',
    logName:
     'projects/joe-test-8675309/logs/cloudaudit.googleapis.com%2Factivity',
    operation: null,
    trace: '',
    sourceLocation: null,
    receiveTimestamp: { seconds: '1577807974', nanos: 105817306 },
    metadata: null,
    spanId: '',
    traceSampled: false,
    textPayload:"An arbitrary payload string",
    payload: 'textPayload' };

const LOG_EVENT_PROTO_PAYLOAD = { labels: {},
    insertId: '-qwnqhydhp96',
    httpRequest: null,
    resource: { labels: [Object], type: 'project' },
    timestamp: { seconds: '1577807973', nanos: 776000000 },
    severity: 'NOTICE',
    logName:
     'projects/joe-test-8675309/logs/cloudaudit.googleapis.com%2Factivity',
    operation: null,
    trace: '',
    sourceLocation: null,
    receiveTimestamp: { seconds: '1577807974', nanos: 105817306 },
    metadata: null,
    spanId: '',
    traceSampled: false,
    protoPayload:
     { type_url: 'type.googleapis.com/google.cloud.audit.AuditLog',
       value:"Some buffer"
     },
    payload: 'protoPayload' };

const FUNCTION_ARN = 'arn:aws:lambda:us-east-1:352283894008:function:test-01-CollectLambdaFunction-2CWNLPPW5XO8';
const FUNCTION_NAME = 'test-TestCollectLambdaFunction-1JNNKQIPOTEST';

module.exports = {
    AIMS_TEST_CREDS: AIMS_TEST_CREDS,
    FUNCTION_ARN: FUNCTION_ARN,
    FUNCTION_NAME: FUNCTION_NAME,
    LOG_EVENT_JSON_PAYLOAD,
    LOG_EVENT_TEXT_PAYLOAD,
    LOG_EVENT_PROTO_PAYLOAD
};
