process.env.AWS_REGION = 'us-east-1';
process.env.al_api = 'api.global-services.global.alertlogic.com';
process.env.ingest_api = 'ingest.global-services.global.alertlogic.com';
process.env.azcollect_api = 'azcollect.global-services.global.alertlogic.com';
process.env.collector_status_api = 'collector_status.global-services.global.alertlogic.com';
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

const ATTACHMENT_PROTECT_LOGS_EVENT = {
    "senderAddress":"senderAddress",
    "recipientAddress":"recipientAddress",
    "fileName":"Test CIS Report 2021-05-25 00:00 Test.pdf",
    "fileType":"application/pdf",
    "result":"safe",
    "actionTriggered":"none",
    "date":"2021-05-25T00:00:09+0000",
    "details":"Safe Time taken: 0 hrs, 0 min, 4 sec",
    "route":"inbound",
    "messageId":"messageId@email.sssss.com",
    "subject":"Scheduled Report Test",
    "fileHash":"fileHash",
    "definition":"Default Attachment Scanning Definition"
};

const URL_PROTECT_LOGS_EVENT = {
    "userEmailAddress":"userEmailAddress",
    "fromUserEmailAddress":"fromUserEmailAddress",
    "url":"url",
    "ttpDefinition":"Default URL Scanning Definition",
    "subject":"subject",
    "action":"allow",
    "adminOverride":"N/A",
    "userOverride":"None",
    "scanResult":"clean",
    "category":"Computers Technology",
    "sendingIp":"149.72.61.166",
    "userAwarenessAction":"N/A",
    "date":"2021-05-15T15:56:48+0000",
    "actions":"Allow",
    "route":"inbound",
    "creationMethod":"User Click",
    "emailPartsDescription":"Body",
    "messageId":"messageId"
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
    ATTACHMENT_PROTECT_LOGS_EVENT: ATTACHMENT_PROTECT_LOGS_EVENT,
    URL_PROTECT_LOGS_EVENT: URL_PROTECT_LOGS_EVENT,
    MALWARE_FEED_LOGS_EVENT:MALWARE_FEED_LOGS_EVENT,
    SIEM_LOGS_EVENT:SIEM_LOGS_EVENT
};
