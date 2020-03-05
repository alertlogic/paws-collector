process.env.AWS_REGION = 'us-east-1';
process.env.al_api = 'api.global-services.global.alertlogic.com';
process.env.ingest_api = 'ingest.global-services.global.alertlogic.com';
process.env.azollect_api = 'azcollect.global-services.global.alertlogic.com';
process.env.aims_access_key_id = 'aims-key-id';
process.env.aims_secret_key = 'aims-secret-key-encrypted';
process.env.log_group = 'logGroupName';
process.env.paws_state_queue_arn = "arn:aws:sqs:us-east-1:352283894008:paws-state-queue";
process.env.paws_type_name = 'auth0';
process.env.paws_endpoint = 'https://test.alertlogic.com/';
process.env.paws_client_id = 'auth0-client-id';
process.env.paws_api_secret = 'auth0-token';
process.env.collector_id = 'collector-id';
process.env.paws_poll_interval = 60;
process.env.paws_secret_param_name = 'PAWS-SECRET-auth0';
process.env.al_application_id = 'auth0';

const AIMS_TEST_CREDS = {
    access_key_id: 'test-access-key-id',
    secret_key: 'test-secret-key'
};

const AUTH0_LOG_EVENT = {
        "date": "2020-01-13T15:19:38.386Z",
        "type": "fsa",
        "description": "Callback URL mismatch. https://account-beta-navigation.ui-dev.product.dev.alertlogic.com is not in the list of allowed callback URLs",
        "ip": "186.146.147.72",
        "user_agent": "Chrome 79.0.3945 / Mac OS X 10.14.6",
        "details": {
          "body": {},
          "qs": {
            "client_id": "SomeClienIt",
            "response_type": "token id_token",
            "redirect_uri": "https://account-beta-navigation.ui-dev.product.dev.alertlogic.com",
            "scope": "openid user_metadata",
            "audience": "https://alertlogic.com/",
            "prompt": "none",
            "state": "kZHEddx~cnenEqTXpQZO3-6ekOqtz~CO",
            "nonce": "byqjPRX1tDj9dX_8SB3eHG54e4lUNQLE",
            "response_mode": "web_message",
            "auth0Client": "auth0Client="
          },
          "connection": null,
          "error": {
            "message": "Callback URL mismatch. https://account-beta-navigation.ui-dev.product.dev.alertlogic.com is not in the list of allowed callback URLs",
            "oauthError": "Callback URL mismatch. https://account-beta-navigation.ui-dev.product.dev.alertlogic.com is not in the list of allowed callback URLs. Please go to 'https://manage.auth0.com/#/applications/8eMblSx2Ead6nT7SeXffXbHT1I4JyAI4/settings' and make sure you are sending the same callback url from your application.",
            "payload": {
              "message": "Callback URL mismatch. https://account-beta-navigation.ui-dev.product.dev.alertlogic.com is not in the list of allowed callback URLs",
              "code": "unauthorized_client",
              "status": 403,
              "name": "CallbackMismatchError",
              "authorized": [
                "http://localhost:8080"
              ],
              "attempt": "https://account-beta-navigation.ui-dev.product.dev.alertlogic.com",
              "client": {
                "clientID": "8eMblSx2Ead6nT7SeXffXbHT1I4JyAI4"
              },
              "log_url": "https://manage.auth0.com/#/logs/"
            },
            "type": "callback-url-mismatch"
          }
        },
        "hostname": "alertlogic-integration.auth0.com",
        "auth0_client": {
          "name": "auth0.js",
          "version": "9.12.1"
        },
        "log_id": "90020200113151943625000993024408641221974042823186448498",
        "_id": "90020200113151943625000993024408641221974042823186448498",
        "isMobile": false
      };

const FUNCTION_ARN = 'arn:aws:lambda:us-east-1:352283894008:function:test-01-CollectLambdaFunction-2CWNLPPW5XO8';
const FUNCTION_NAME = 'test-TestCollectLambdaFunction-1JNNKQIPOTEST';

module.exports = {
    AIMS_TEST_CREDS: AIMS_TEST_CREDS,
    FUNCTION_ARN: FUNCTION_ARN,
    FUNCTION_NAME: FUNCTION_NAME,
    AUTH0_LOG_EVENT: AUTH0_LOG_EVENT
};
