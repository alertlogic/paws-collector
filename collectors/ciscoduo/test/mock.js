process.env.AWS_REGION = 'us-east-1';
process.env.al_api = 'api.global-services.global.alertlogic.com';
process.env.ingest_api = 'ingest.global-services.global.alertlogic.com';
process.env.azollect_api = 'azcollect.global-services.global.alertlogic.com';
process.env.aims_access_key_id = 'aims-key-id';
process.env.aims_secret_key = 'aims-secret-key-encrypted';
process.env.log_group = 'logGroupName';
process.env.paws_state_queue_arn = "arn:aws:sqs:us-east-1:352283894008:paws-state-queue";
process.env.paws_type_name = 'ciscoduo';
process.env.ciscoduo_endpoint = 'https://test.alertlogic.com/';
process.env.ciscoduo_token = 'ciscoduo-token';
process.env.collector_id = 'collector-id';
process.env.paws_secret_param_name = 'PAWS-SECRET-auth0';
process.env.paws_poll_interval = 60;

const AIMS_TEST_CREDS = {
    access_key_id: 'test-access-key-id',
    secret_key: 'test-secret-key'
};

const ADMIN_OK_RESP = {
        "stat": "OK",
        "response": [{
            "action": "admin_login_error",
            "description": "{\"ip_address\": \"10.1.23.116\", \"error\": \"SAML login is disabled\", \"email\": \"narroway@example.com\"}",
            "object": null,
            "timestamp": 1446172820,
            "username": ""
        }]
      };

const AUTH_OK_RESP = {
        "response": {
            "authlogs": [
                {
                    "access_device": {
                        "browser": "Chrome",
                        "browser_version": "67.0.3396.99",
                        "flash_version": "uninstalled",
                        "hostname": "null",
                        "ip": "169.232.89.219",
                        "java_version": "uninstalled",
                        "location": {
                            "city": "Ann Arbor",
                            "country": "United States",
                            "state": "Michigan"
                        },
                        "os": "Mac OS X",
                        "os_version": "10.14.1"
                    },
                    "application": {
                        "key": "DIY231J8BR23QK4UKBY8",
                        "name": "Microsoft Azure Active Directory"
                    },
                    "auth_device": {
                        "ip": "192.168.225.254",
                        "location": {
                            "city": "Ann Arbor",
                            "country": "United States",
                            "state": "Michigan"
                        },
                        "name": "My iPhone X (734-555-2342)"
                    },
                    "event_type": "authentication",
                    "factor": "duo_push",
                    "reason": "user_approved",
                    "result": "success",
                    "timestamp": 1532951962,
                    "trusted_endpoint_status": "not trusted",
                    "txid": "340a23e3-23f3-23c1-87dc-1491a23dfdbb",
                    "user": {
                        "key": "DU3KC77WJ06Y5HIV7XKQ",
                        "name": "narroway@example.com"
                    }
                },
             ],
            "metadata": {
                "next_offset": [
                    "1532951895000",
                    "af0ba235-0b33-23c8-bc23-a31aa0231de8"
                ],
                "total_objects": 1
            }
        },
        "stat": "OK"
    };

const FUNCTION_ARN = 'arn:aws:lambda:us-east-1:352283894008:function:test-01-CollectLambdaFunction-2CWNLPPW5XO8';
const FUNCTION_NAME = 'test-TestCollectLambdaFunction-1JNNKQIPOTEST';

module.exports = {
    AIMS_TEST_CREDS: AIMS_TEST_CREDS,
    FUNCTION_ARN: FUNCTION_ARN,
    FUNCTION_NAME: FUNCTION_NAME,
    AUTH_OK_RESP: AUTH_OK_RESP,
    ADMIN_OK_RESP: ADMIN_OK_RESP
};
