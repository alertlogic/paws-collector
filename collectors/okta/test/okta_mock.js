process.env.AWS_REGION = 'us-east-1';
process.env.al_api = 'api.global-services.global.alertlogic.com';
process.env.ingest_api = 'ingest.global-services.global.alertlogic.com';
process.env.azollect_api = 'azcollect.global-services.global.alertlogic.com';
process.env.aims_access_key_id = 'aims-key-id';
process.env.aims_secret_key = 'aims-secret-key-encrypted';
process.env.log_group = 'logGroupName';
process.env.paws_state_queue_arn = "arn:aws:sqs:us-east-1:352283894008:paws-state-queue";
process.env.paws_type_name = 'okta';
process.env.paws_endpoint = 'https://test.alertlogic.com/';
process.env.paws_api_secret = 'okta-token';
process.env.collector_id = 'collector-id';
process.env.paws_poll_interval = 60;

const AIMS_TEST_CREDS = {
    access_key_id: 'test-access-key-id',
    secret_key: 'test-secret-key'
};

const OKTA_LOG_EVENT = {
      "version": "0",
      "severity": "INFO",
      "client": {
        "zone": "OFF_NETWORK",
        "device": "Unknown",
        "userAgent": {
          "os": "Unknown",
          "browser": "UNKNOWN",
          "rawUserAgent": "UNKNOWN-DOWNLOAD"
        },
        "ipAddress": "12.97.85.90"
      },
      "actor": {
        "id": "00u1qw1mqitPHM8AJ0g7",
        "type": "User",
        "alternateId": "admin@tc1-trexcloud.com",
        "displayName": "John Fung"
      },
      "outcome": {
        "result": "SUCCESS"
      },
      "uuid": "f790999f-fe87-467a-9880-6982a583986c",
      "published": "2017-09-31T22:23:07.777Z",
      "eventType": "user.session.start",
      "displayMessage": "User login to Okta",
      "transaction": {
        "type": "WEB",
        "id": "V04Oy4ubUOc5UuG6s9DyNQAABtc"
      },
      "debugContext": {
        "debugData": {
          "requestUri": "/login/do-login"
        }
      },
      "legacyEventType": "core.user_auth.login_success",
      "authenticationContext": {
        "authenticationStep": 0,
        "externalSessionId": "1013FfF-DKQSvCI4RVXChzX-w"
      }
    };

const FUNCTION_ARN = 'arn:aws:lambda:us-east-1:352283894008:function:test-01-CollectLambdaFunction-2CWNLPPW5XO8';
const FUNCTION_NAME = 'test-TestCollectLambdaFunction-1JNNKQIPOTEST';

module.exports = {
    AIMS_TEST_CREDS: AIMS_TEST_CREDS,
    FUNCTION_ARN: FUNCTION_ARN,
    FUNCTION_NAME: FUNCTION_NAME,
    OKTA_LOG_EVENT: OKTA_LOG_EVENT
};
