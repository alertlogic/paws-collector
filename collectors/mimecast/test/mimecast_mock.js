process.env.AWS_REGION = 'us-east-1';
process.env.al_api = 'api.global-services.global.alertlogic.com';
process.env.ingest_api = 'ingest.global-services.global.alertlogic.com';
process.env.azollect_api = 'azcollect.global-services.global.alertlogic.com';
process.env.aims_access_key_id = 'aims-key-id';
process.env.aims_secret_key = 'aims-secret-key-encrypted';
process.env.log_group = 'logGroupName';
process.env.paws_state_queue_arn = "arn:aws:sqs:us-east-1:352283894008:paws-state-queue";
process.env.paws_extension = 'mimecast';
process.env.mimecast_endpoint = 'https://test.alertlogic.com/';
process.env.mimecast_token = 'mimecast-token';
process.env.collector_id = 'collector-id';
process.env.al_application_id = 'application_id';
process.env.paws_secret_param_name = "mimecast-param-name";
process.env.paws_poll_interval = 60;
process.env.paws_type_name = "mimecast";
process.env.paws_api_secret = "secret";
process.env.paws_endpoint = "https://mimecast.com";
process.env.paws_api_client_id = "client-id";
process.env.collector_streams = "[\"SiemLogs\", \"AttachmentProtectLogs\", \"URLProtectLogs\", \"MalwareFeed\" ]";
process.env.paws_collector_param_string_1 = "APPLICATION_ID";
process.env.paws_collector_param_string_2 = "APPLICATION_KEY";

const AIMS_TEST_CREDS = {
    access_key_id: 'test-access-key-id',
    secret_key: 'test-secret-key'
};

const LOG_EVENT = {
    "result": "result",
    "date": "2020-10-01T23:59:59+0000",
    "senderAddress": "senderAddress",
    "fileName": "fileName",
    "actiontriggered": "actiontriggered",
    "route": "route",
    "details": "details",
    "recipientAddress": "recipientAddress",
    "fileType": "fileType"
};

const CLICK_LOGS_EVENT = {
    "category": "String",
    "userEmailAddress": "String",
    "url": "String",
    "userAwarenessAction": "String",
    "route": "String",
    "adminOverride": "String",
    "date": "String",
    "scanResult": "String",
    "action": "String",
    "ttpDefinition": "String",
    "userOverride": "String"
};

const MALWARE_FEED_LOGS_EVENT = {
    "type": "malware",
    "id": "malware--94b21aa9-a512-4a09-ae8a-83a24f77567f",
    "created": "2015-07-02T09:14:59.163Z",
    "modified": "2015-07-02T09:14:59.163Z",
    "name": "fileName.ext",
    "labels": [
        "virus"
    ]
};
const SIEM_LOGS_EVENT = {
    "type": "MTA",
    "data": [
        {
            "acc": "SSSSSS",
            "Sender": "noreply@example.com",
            "datetime": "2021-05-12T02:18:02-0400",
            "AttSize": 0,
            "Act": "Acc",
            "aCode": "SSSSSSS",
            "AttCnt": 0,
            "AttNames": null,
            "MsgSize": 6065,
            "MsgId": "<id>",
            "Subject": "Re: [SUB] ENG-0000 : System Extensions for mac (#1)"
        }]
};

const FUNCTION_ARN = 'arn:aws:lambda:us-east-1:352283894008:function:test-01-CollectLambdaFunction-2CWNLPPW5XO8';
const FUNCTION_NAME = 'test-TestCollectLambdaFunction-1JNNKQIPOTEST';

module.exports = {
    AIMS_TEST_CREDS: AIMS_TEST_CREDS,
    FUNCTION_ARN: FUNCTION_ARN,
    FUNCTION_NAME: FUNCTION_NAME,
    LOG_EVENT: LOG_EVENT,
    CLICK_LOGS_EVENT: CLICK_LOGS_EVENT,
    MALWARE_FEED_LOGS_EVENT:MALWARE_FEED_LOGS_EVENT,
    SIEM_LOGS_EVENT:SIEM_LOGS_EVENT
};
