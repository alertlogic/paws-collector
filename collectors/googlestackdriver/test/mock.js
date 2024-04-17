process.env.AWS_REGION = 'us-east-1';
process.env.al_api = 'api.global-services.global.alertlogic.com';
process.env.ingest_api = 'ingest.global-services.global.alertlogic.com';
process.env.azcollect_api = 'azcollect.global-services.global.alertlogic.com';
process.env.collector_status_api = 'collector_status.global-services.global.alertlogic.com';
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
       value:{"type":"Buffer","data":[18,0,26,168,2,10,54,117,115,97,99,115,45,115,105,101,109,64,119,101,98,45,99,111,110,115,111,108,101,45,109,105,100,101,111,105,100,46,105,97,109,46,103,115,101,114,118,105,99,101,97,99,99,111,117,110,116,46,99,111,109,42,166,1,47,47,105,97,109,46,103,111,111,103,108,101,97,112,105,115,46,99,111,109,47,112,114,111,106,101,99,116,115,47,119,101,98,45,99,111,110,115,111,108,101,45,109,105,100,101,111,105,100,47,115,101,114,118,105,99,101,65,99,99,111,117,110,116,115,47,117,115,97,99,115,45,115,105,101,109,64,119,101,98,45,99,111,110,115,111,108,101,45,109,105,100,101,111,105,100,46,105,97,109,46,103,115,101,114,118,105,99,101,97,99,99,111,117,110,116,46,99,111,109,47,107,101,121,115,47,48,48,53,51,56,57,57,98,50,49,56,49,54,97,102,52,99,53,100,100,101,50,100,54,102,54,50,56,56,49,52,100,100,48,101,97,53,98,51,98,66,69,115,101,114,118,105,99,101,65,99,99,111,117,110,116,58,117,115,97,99,115,45,115,105,101,109,64,119,101,98,45,99,111,110,115,111,108,101,45,109,105,100,101,111,105,100,46,105,97,109,46,103,115,101,114,118,105,99,101,97,99,99,111,117,110,116,46,99,111,109,34,65,10,12,51,46,50,51,55,46,49,55,46,49,54,51,18,29,103,114,112,99,45,110,111,100,101,45,106,115,47,49,46,49,48,46,48,44,103,122,105,112,40,103,102,101,41,58,16,74,12,8,192,159,179,176,6,16,148,129,149,153,2,106,0,66,0,58,22,108,111,103,103,105,110,103,46,103,111,111,103,108,101,97,112,105,115,46,99,111,109,66,49,103,111,111,103,108,101,46,108,111,103,103,105,110,103,46,118,50,46,76,111,103,103,105,110,103,83,101,114,118,105,99,101,86,50,46,76,105,115,116,76,111,103,69,110,116,114,105,101,115,74,109,10,26,111,114,103,97,110,105,122,97,116,105,111,110,115,47,54,50,50,56,53,50,55,51,55,50,57,52,18,23,108,111,103,103,105,110,103,46,108,111,103,69,110,116,114,105,101,115,46,108,105,115,116,24,1,42,52,10,22,108,111,103,103,105,110,103,46,103,111,111,103,108,101,97,112,105,115,46,99,111,109,18,26,111,114,103,97,110,105,122,97,116,105,111,110,115,47,54,50,50,56,53,50,55,51,55,50,57,52,74,116,10,26,111,114,103,97,110,105,122,97,116,105,111,110,115,47,54,50,50,56,53,50,55,51,55,50,57,52,18,30,108,111,103,103,105,110,103,46,112,114,105,118,97,116,101,76,111,103,69,110,116,114,105,101,115,46,108,105,115,116,24,1,42,52,10,22,108,111,103,103,105,110,103,46,103,111,111,103,108,101,97,112,105,115,46,99,111,109,18,26,111,114,103,97,110,105,122,97,116,105,111,110,115,47,54,50,50,56,53,50,55,51,55,50,57,52,90,26,111,114,103,97,110,105,122,97,116,105,111,110,115,47,54,50,50,56,53,50,55,51,55,50,57,52,130,1,238,1,10,21,10,8,112,97,103,101,83,105,122,101,18,9,17,0,0,0,0,0,64,143,64,10,49,10,13,114,101,115,111,117,114,99,101,78,97,109,101,115,18,32,50,30,10,28,26,26,111,114,103,97,110,105,122,97,116,105,111,110,115,47,54,50,50,56,53,50,55,51,55,50,57,52,10,90,10,6,102,105,108,116,101,114,18,80,26,78,116,105,109,101,115,116,97,109,112,32,62,61,32,34,50,48,50,52,45,48,52,45,48,51,84,48,51,58,50,51,58,48,54,46,48,48,48,90,34,10,116,105,109,101,115,116,97,109,112,32,60,32,34,50,48,50,52,45,48,52,45,48,51,84,48,51,58,50,52,58,48,54,46,48,48,48,90,34,10,70,10,5,64,116,121,112,101,18,61,26,59,116,121,112,101,46,103,111,111,103,108,101,97,112,105,115,46,99,111,109,47,103,111,111,103,108,101,46,108,111,103,103,105,110,103,46,118,50,46,76,105,115,116,76,111,103,69,110,116,114,105,101,115,82,101,113,117,101,115,116]},
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
