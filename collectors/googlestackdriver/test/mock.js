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

const LOG_EVENT_JSON_PAYLOAD = {
    "insertId": "1qpjficfj5i1ow",
    "jsonPayload": { "anotherKey": "RCS test value", "key": "RCS" },
    "resource": {
        "type": "global",
        "labels": { "project_id": "rcs-test-project-422212" }
    },
    "timestamp": "2024-06-19T11:35:55.669107201Z",
    "logName": "projects/rcs-test-project-422212/logs/my-json-log",
    "receiveTimestamp": "2024-06-19T11:35:55.669107201Z"
};

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

const LOG_EVENT_PROTO_PAYLOAD =  {
    "protoPayload": {
      "@type": "type.googleapis.com/google.cloud.audit.AuditLog",
      "status": {},
      "authenticationInfo": {
        "principalEmail": "imran@imranalisyed.com",
        "principalSubject": "user:imran@imranalisyed.com"
      },
      "requestMetadata": {
        "callerIp": "117.247.121.80",
        "callerSuppliedUserAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36,gzip(gfe)",
        "requestAttributes": {
          "time": "2024-04-02T08:17:37.461922381Z",
          "auth": {}
        },
        "destinationAttributes": {}
      },
      "serviceName": "iam.googleapis.com",
      "methodName": "google.iam.admin.v1.DisableServiceAccount",
      "authorizationInfo": [
        {
          "resource": "projects/-/serviceAccounts/109840067714345269337",
          "permission": "iam.serviceAccounts.disable",
          "granted": true,
          "resourceAttributes": {
            "name": "projects/-/serviceAccounts/109840067714345269337"
          },
          "permissionType": "ADMIN_WRITE"
        }
      ],
      "resourceName": "projects/-/serviceAccounts/109840067714345269337",
      "request": {
        "@type": "type.googleapis.com/google.iam.admin.v1.DisableServiceAccountRequest",
        "name": "projects/imran-49253/serviceAccounts/109840067714345269337"
      },
      "response": {"@type": "type.googleapis.com/google.protobuf.Empty"}
    },
    "insertId": "5010heeipdi5",
    "resource": {
      "type": "service_account",
      "labels": {
        "project_id": "imran-49253",
        "unique_id": "109840067714345269337",
        "email_id": "im-service-account-private@imran-49253.iam.gserviceaccount.com"
      }
    },
    "timestamp": "2024-04-02T08:17:37.433885372Z",
    "severity": "NOTICE",
    "logName": "projects/imran-49253/logs/cloudaudit.googleapis.com%2Factivity",
    "receiveTimestamp": "2024-04-02T08:17:37.896768264Z"
  };

const LOG_EVENT_PROTO_PAYLOAD2 =
{
    "protoPayload": {
        "@type": "type.googleapis.com/google.cloud.audit.AuditLog",
        "status": {},
        "authenticationInfo": {
            "principalEmail": "imran@imranalisyed.com",
            "principalSubject": "user:imran@imranalisyed.com"
        },
        "requestMetadata": {
            "callerIp": "117.247.121.80",
            "callerSuppliedUserAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36,gzip(gfe)",
            "requestAttributes": {
                "time": "2024-04-02T08:17:37.461922381Z",
                "auth": {}
            },
            "destinationAttributes": {}
        },
        "serviceName": "iam.googleapis.com",
        "methodName": "google.iam.admin.v1.DisableServiceAccount",
        "authorizationInfo": [
            {
                "resource": "projects/-/serviceAccounts/109840067714345269337",
                "permission": "iam.serviceAccounts.disable",
                "granted": true,
                "resourceAttributes": {
                    "name": "projects/-/serviceAccounts/109840067714345269337"
                },
                "permissionType": "ADMIN_WRITE"
            }
        ],
        "resourceName": "projects/-/serviceAccounts/109840067714345269337",
        "request": {
            "@type": "type.googleapis.com/google.iam.admin.v1.DisableServiceAccountRequest",
            "name": "projects/imran-49253/serviceAccounts/109840067714345269337"
        },
        "response": { "@type": "type.googleapis.com/google.protobuf.Empty" }
    },
    "insertId": "5010heeipdi5",
    "resource": {
        "type": "service_account",
        "labels": {
            "project_id": "imran-49253",
            "unique_id": "109840067714345269337",
            "email_id": "im-service-account-private@imran-49253.iam.gserviceaccount.com"
        }
    },
    "timestamp": "2024-04-02T08:17:37.433885372Z",
    "severity": "NOTICE",
    "logName": "projects/imran-49253/logs/cloudaudit.googleapis.com%2Factivity",
    "receiveTimestamp": "2024-04-02T08:17:37.896768264Z"
};
      
const LOG_EVENT_PROTO_PAYLOAD_FULL_RESPONSE = {
    "config": {
        "url": "https://logging.googleapis.com/v2/entries:list?filter=timestamp%20%3E%3D%20%222024-04-02T00%3A00%3A00Z%22%0Atimestamp%20%3C%20%222024-05-02T09%3A00%3A00Z%22&pageSize=2&resourceNames=projects%2Fimran-49253",
        "method": "POST",
        "userAgentDirectives": [
            {
                "product": "google-api-nodejs-client",
                "version": "7.2.0",
                "comment": "gzip"
            }
        ],
        "headers": {
            "x-goog-api-client": "gdcl/7.2.0 gl-node/18.20.2",
            "Accept-Encoding": "gzip",
            "User-Agent": "google-api-nodejs-client/7.2.0 (gzip)",
            "Authorization": "Bearer ya29.c.c0AY_VpZhO_4yAOowLfMvaiTiu4_1BUMvHiNgCG18GiH0SZOjd5ZhLQRoB5U4ouyR98R0KjcO5vP8jQ1RZqRONwSUVPmrioCIdOqR1kQsgvm54q7atKqGVlly1xTDQEQpVCfY36mPmzHWfsW2miO_gwNx4E85zyrI7ntIfZ579OV0hxnbl1yJhDooW8oYtl0CWAPXCQ4qZDe7lQdI_ss71al_E-IyA2oJ5fEWFPk72q-hZ03FnBubXyjtlEtSuv7V_FS3Ziy9s9xS9tZjGUC2FR6XMOYLf5N-aPbuawHyk383jnqCT_6wBEqCFS8tFycb5H85NvBoyE7hHHmO4TJMriAKueUbsxXzj48RRDQh1oNMtDLNNkikmsnrn8zFZxVxjqm8XH397A6qUnxbouaU56MY4XafU6B_75hI3JqXrbeu9bk_nYRozbWiwFzFnfM56Fez_YW98ZoOtzv9f7iQMI9r0zt5n3lRtdeqO6kq-6YmtWFWsoYM-umQa7yhlF52VwykwZvfBW-Fwtcm_RY8FnVtdr8c22qUV4gqFlWoSlJSdarIoaS383j8va5m3h_Oyt_iIXYo7l6cy3gRwioh_cFUt0W0llRoYgI--MxSkrsvYcrcg2fXUvb7j8_x2yfelmtUgobwtqV4mqcW0vrSl7Of18t0R2OoR9wJmhxs10YQ7Z2ozsj3Oey5Y1lZYUR5R3BpV3WIXV8rM-m2UbcwU6x2YmyByIsY08cqbOWefqBhZFRksVnlRyiJm-ufsf1wVrJJkfuB6iSWSYmZaq5YngYMmVb7yWMgsoyO64VQi2dR1Vtrc4aM6j2eRefvcwuX1f04OjcpcdogyOkrjkbp6t6UtucapjRUo4h83XtdJdstZW6WcMlOW9BbFvyoi8-WQd33S1UXo2_JphfxFYno-_timh5BsBX-09ZmpaZgSzv19zFx7MS7qMp0o56mJFFXI-bibSOW1deyjXB4_Qv-iOdcn038qjxB8fvejxVSYpScda8Je9OsQi9J"
        },
        "params": {
            "filter": "timestamp >= \"2024-04-02T00:00:00Z\"\ntimestamp < \"2024-05-02T09:00:00Z\"",
            "pageSize": 2,
            "resourceNames": ["projects/imran-49253"]
        },
        "retry": true,
        "responseType": "unknown"
    },
    "data": {
        "entries": [
            {
                "protoPayload": {
                    "@type": "type.googleapis.com/google.cloud.audit.AuditLog",
                    "status": {},
                    "authenticationInfo": {
                        "principalEmail": "imran@imranalisyed.com",
                        "principalSubject": "user:imran@imranalisyed.com"
                    },
                    "requestMetadata": {
                        "callerIp": "117.247.121.80",
                        "callerSuppliedUserAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36,gzip(gfe)",
                        "requestAttributes": {
                            "time": "2024-04-02T08:17:37.461922381Z",
                            "auth": {}
                        },
                        "destinationAttributes": {}
                    },
                    "serviceName": "iam.googleapis.com",
                    "methodName": "google.iam.admin.v1.DisableServiceAccount",
                    "authorizationInfo": [
                        {
                            "resource": "projects/-/serviceAccounts/109840067714345269337",
                            "permission": "iam.serviceAccounts.disable",
                            "granted": true,
                            "resourceAttributes": {
                                "name": "projects/-/serviceAccounts/109840067714345269337"
                            },
                            "permissionType": "ADMIN_WRITE"
                        }
                    ],
                    "resourceName": "projects/-/serviceAccounts/109840067714345269337",
                    "request": {
                        "@type": "type.googleapis.com/google.iam.admin.v1.DisableServiceAccountRequest",
                        "name": "projects/imran-49253/serviceAccounts/109840067714345269337"
                    },
                    "response": { "@type": "type.googleapis.com/google.protobuf.Empty" }
                },
                "insertId": "5010heeipdi5",
                "resource": {
                    "type": "service_account",
                    "labels": {
                        "project_id": "imran-49253",
                        "unique_id": "109840067714345269337",
                        "email_id": "im-service-account-private@imran-49253.iam.gserviceaccount.com"
                    }
                },
                "timestamp": "2024-04-02T08:17:37.433885372Z",
                "severity": "NOTICE",
                "logName": "projects/imran-49253/logs/cloudaudit.googleapis.com%2Factivity",
                "receiveTimestamp": "2024-04-02T08:17:37.896768264Z"
            },
            {
                "protoPayload": {
                    "@type": "type.googleapis.com/google.cloud.audit.AuditLog",
                    "status": {},
                    "authenticationInfo": {
                        "principalEmail": "imran@imranalisyed.com",
                        "principalSubject": "user:imran@imranalisyed.com"
                    },
                    "requestMetadata": {
                        "callerIp": "117.247.121.80",
                        "callerSuppliedUserAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36,gzip(gfe)",
                        "requestAttributes": {
                            "time": "2024-04-02T08:17:44.102276215Z",
                            "auth": {}
                        },
                        "destinationAttributes": {}
                    },
                    "serviceName": "iam.googleapis.com",
                    "methodName": "google.iam.admin.v1.EnableServiceAccount",
                    "authorizationInfo": [
                        {
                            "resource": "projects/-/serviceAccounts/109840067714345269337",
                            "permission": "iam.serviceAccounts.enable",
                            "granted": true,
                            "resourceAttributes": {
                                "name": "projects/-/serviceAccounts/109840067714345269337"
                            },
                            "permissionType": "ADMIN_WRITE"
                        }
                    ],
                    "resourceName": "projects/-/serviceAccounts/109840067714345269337",
                    "request": {
                        "name": "projects/imran-49253/serviceAccounts/109840067714345269337",
                        "@type": "type.googleapis.com/google.iam.admin.v1.EnableServiceAccountRequest"
                    },
                    "response": { "@type": "type.googleapis.com/google.protobuf.Empty" }
                },
                "insertId": "tp7fahemm6er",
                "resource": {
                    "type": "service_account",
                    "labels": {
                        "project_id": "imran-49253",
                        "email_id": "im-service-account-private@imran-49253.iam.gserviceaccount.com",
                        "unique_id": "109840067714345269337"
                    }
                },
                "timestamp": "2024-04-02T08:17:44.079997875Z",
                "severity": "NOTICE",
                "logName": "projects/imran-49253/logs/cloudaudit.googleapis.com%2Factivity",
                "receiveTimestamp": "2024-04-02T08:17:46.016142953Z"
            }
        ],
        "nextPageToken": "EAA4pc_Fx5eu94u6AUrqBSIeIg8KDXRwN2ZhaGVtbTZlcgAqCwio_q6wBhCz15ImSscFCqEFSp4FANAvIAZXvD3Q4F75FqIg-h8Up15-eWH2NS_4P0K-lrH6j5NWGF0U8OXHubt98xgvkXuO1IzppzwkNuoGl7mW-NhhjI-IOgBV9bPbWlD-bnpz7pgpRBWFfILJDfRwlMzxDrV6q6gY-Zg8nNSM2Ae_ADOVtwEUxS_q1BevEuxHQDOEdwA0ke5qMO5xgofmIbFmcIVEmevNOZ-6cJx1SJLPEpoPQqV-hF_jpvCxkXbNUYX93KqHWDx8IbeU9TyJyPeVYciTuK2ptcYe3gJLTRMe7jdiv4EQ_eqgoljTBlhKLUtPT6F6k0ssrQ6KRSltex2bNeQT_fO33svWHVU5AT2q1TkdkbZ9SroeeYWXOnwJqNHNJR4uFcF_Z6393fAqaMdmzX-9rXYNsrsSShhyaSFAlZtWZZ15UBE0cwYaFTVkgzXpe0GuDtuTgBG01SZQRuvntlSxJbASAZIcrBawtyiFfumsw1uUWDEPQiRMk4613a_WNtzbSWK74lOvmdsqWKYaxjUrDmUsZwtQupUsCBqUXBpd83neOGwantHzCr_4CkTqz2azhP-myAXnr90TS_ecb7ho3aDpk7kMI-lOxKsqYUGrJgn4A-kmcjqNlh12vNSHgsknaTKRjevnpGCerP5lt5n9ZakO-BZqAlcFIOHE0nhgKJ9v9yo2yWMv2JmsctzDlmreLkYgJIlBpCqgHkHP7Fwz6j5A8Wb5dbFqndd-gLVGiOR2co4f_BnCPMa1nlLH7VuAXgGO1ZQ4ViSF1e4cfanpvIrJ1WchfDzpF-NRebDQXysWe3wJKImx45VskYPQbxs0LIvBxglVt8eqb5duDyuBVpsWWAVpypWaS-Qa4DasY203NrbPhrJlkRsFad9QVGE0D1bsmNkQD7BS_hIWGgYIgPausAYiDAj_mLSwBhD_k-vcA1DY16Hg2fS6hLABUgcI16S-uJ4eYKKsh4edoIXVfmocCgwI8eOgswYQkrimqgMSCAgBEOLJuNkCGAIgAA"
    },
    "headers": {
        "alt-svc": "h3=\":443\"; ma=2592000,h3-29=\":443\"; ma=2592000",
        "cache-control": "private",
        "connection": "close",
        "content-encoding": "gzip",
        "content-type": "application/json; charset=UTF-8",
        "date": "Tue, 11 Jun 2024 11:16:03 GMT",
        "server": "ESF",
        "server-timing": "gfet4t7; dur=1760",
        "transfer-encoding": "chunked",
        "vary": "Origin, X-Origin, Referer",
        "x-content-type-options": "nosniff",
        "x-frame-options": "SAMEORIGIN",
        "x-xss-protection": "0"
    },
    "status": 200,
    "statusText": "OK",
    "request": {
        "responseURL": "https://logging.googleapis.com/v2/entries:list?filter=timestamp%20%3E%3D%20%222024-04-02T00%3A00%3A00Z%22%0Atimestamp%20%3C%20%222024-05-02T09%3A00%3A00Z%22&pageSize=2&resourceNames=projects%2Fimran-49253"
    }
};

const FUNCTION_ARN = 'arn:aws:lambda:us-east-1:352283894008:function:test-01-CollectLambdaFunction-2CWNLPPW5XO8';
const FUNCTION_NAME = 'test-TestCollectLambdaFunction-1JNNKQIPOTEST';
const MOCK_ENTRIES = {
    list: () => { }
};
module.exports = {
    AIMS_TEST_CREDS: AIMS_TEST_CREDS,
    FUNCTION_ARN: FUNCTION_ARN,
    FUNCTION_NAME: FUNCTION_NAME,
    LOG_EVENT_JSON_PAYLOAD,
    LOG_EVENT_TEXT_PAYLOAD,
    LOG_EVENT_PROTO_PAYLOAD,
    LOG_EVENT_PROTO_PAYLOAD2,
    LOG_EVENT_PROTO_PAYLOAD_FULL_RESPONSE,
    MOCK_ENTRIES: MOCK_ENTRIES
};
