process.env.AWS_REGION = 'us-east-1';
process.env.al_api = 'api.global-services.global.alertlogic.com';
process.env.ingest_api = 'ingest.global-services.global.alertlogic.com';
process.env.azcollect_api = 'azcollect.global-services.global.alertlogic.com';
process.env.collector_status_api = 'collector_status.global-services.global.alertlogic.com';
process.env.aims_access_key_id = 'aims-key-id';
process.env.aims_secret_key = 'aims-secret-key-encrypted';
process.env.paws_api_secret = 'paws-secret-key-encrypted';
process.env.log_group = 'logGroupName';
process.env.paws_state_queue_arn = "arn:aws:sqs:us-east-1:352283894008:paws-state-queue";
process.env.paws_extension = 'gsuite';
process.env.paws_endpoint = 'https://test.alertlogic.com/';
process.env.gsuite_token = 'gsuite-token';
process.env.collector_id = 'collector-id';
process.env.al_application_id = 'gsuite';
process.env.paws_poll_interval = 60;
process.env.paws_type_name = "gsuite";
process.env.paws_secret_param_name = "gsuite-param-name";
process.env.paws_collector_param_string_1 = "[\"gsuiteScope\"]";
process.env.collector_streams = "[\"login\",\"admin\",\"token\"]";
process.env.paws_max_pages_per_invocation = 2;
process.env.AWS_LAMBDA_FUNCTION_NAME = "test";

const AIMS_TEST_CREDS = {
    access_key_id: 'test-access-key-id',
    secret_key: 'test-secret-key'
};

const LOG_EVENT = {
    "kind": "admin#reports#activity",
    "id": {
        "time": "2020-01-09T05:56:41.462Z",
        "uniqueQualifier": "210793348270",
        "applicationName": "login",
        "customerId": "ABChsk512"
    },
    "etag": "5sk1-3v2q0CvKziPNftN_ppCLuk/51234567897894561236RNOHRoa",
    "actor": {
        "email": "name@test.com",
        "profileId": "895123456789789456123"
    },
    "ipAddress": "125.255.255.1",
    "events": [
        {
            "type": "login",
            "name": "login_success",
            "parameters": [
                {
                    "name": "login_type",
                    "value": "google_password"
                },
                {
                    "name": "login_challenge_method",
                    "multiValue": [
                        "password"
                    ]
                },
                {
                    "name": "is_suspicious",
                    "boolValue": false
                }
            ]
        }
    ]
};

const LOG_ALERT = {
    "customerId": "03ek00234",
    "alertId": "9923d7c2-161d-45f5-8881-126efca08ccd3",
    "createTime": "2023-04-07T13:57:42.402947Z",
    "startTime": "2023-04-07T13:27:41Z",
    "endTime": "2023-04-07T13:27:41Z",
    "type": "Suspicious login",
    "source": "Google identity",
    "data": {
        "@type": "type.googleapis.com/google.apps.alertcenter.type.AccountWarning",
        "email": "google.cloud.admin@al.com",
        "loginDetails": {
            "loginTime": "2023-04-07T13:27:41Z",
            "ipAddress": "176.58.157.173"
        }
    },
    "securityInvestigationToolLink": "admin.google.com/ac/ac/investigate?alert=BiQ5OTIzZDdjMi0xNjFkLTQ1ZjUtODg4MS05NmVmY2EwOGNjZDM",
    "metadata": {
        "customerId": "03ek00234",
        "alertId": "9923d7c2-161d-45f5-8881-96efca08ccd3",
        "status": "NOT_STARTED",
        "updateTime": "2023-04-07T13:57:42.402947Z",
        "severity": "LOW",
        "etag": "dv4FotmhiJh="
    },
    "updateTime": "2023-04-07T13:57:42.402947Z",
    "etag": "dv4FotmhiJh="
};

const MOCK_ACTIVITES = {
    list: () => { }
};

const MOCK_ALERTS = {
    list: () => { }
};


const FUNCTION_ARN = 'arn:aws:lambda:us-east-1:352283894008:function:test-01-CollectLambdaFunction-2CWNLPPW5XO8';
const FUNCTION_NAME = 'test-TestCollectLambdaFunction-1JNNKQIPOTEST';

module.exports = {
    AIMS_TEST_CREDS: AIMS_TEST_CREDS,
    FUNCTION_ARN: FUNCTION_ARN,
    FUNCTION_NAME: FUNCTION_NAME,
    LOG_EVENT: LOG_EVENT,
    MOCK_ACTIVITES: MOCK_ACTIVITES,
    LOG_ALERT:LOG_ALERT,
    MOCK_ALERTS:MOCK_ALERTS
};
