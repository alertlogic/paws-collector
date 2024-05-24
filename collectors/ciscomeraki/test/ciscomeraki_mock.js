process.env.AWS_REGION = 'us-east-1';
process.env.al_api = 'api.global-services.global.alertlogic.com';
process.env.ingest_api = 'ingest.global-services.global.alertlogic.com';
process.env.azollect_api = 'azcollect.global-services.global.alertlogic.com';
process.env.collector_status_api = 'collector_status.global-services.global.alertlogic.com';

process.env.aims_access_key_id = 'aims-key-id';
process.env.aims_secret_key = 'aims-secret-key-encrypted';
process.env.log_group = 'logGroupName';
process.env.paws_state_queue_arn = "arn:aws:sqs:us-east-1:352283894008:paws-state-queue";
process.env.paws_extension = 'ciscomeraki';
process.env.ciscomeraki_endpoint = 'https://test.alertlogic.com/';
process.env.ciscomeraki_token = 'ciscomeraki-token';
process.env.collector_id = 'collector-id';
process.env.al_application_id = 'application_id';
process.env.paws_secret_param_name = "ciscomeraki-param-name";
process.env.paws_poll_interval = 60;
process.env.paws_type_name = "ciscomeraki";
process.env.paws_collector_param_string_2 = "12345";
process.env.paws_collector_param_string_1 = "[\"appliance\",\"systemsManager\",\"switch\"]";
process.env.paws_api_secret = "secret";
process.env.paws_endpoint = "api.meraki.com";
process.env.collector_streams = "[\"L_686235993220604684\"]";
process.env.paws_api_client_id = "client-id";
process.env.paws_poll_interval_delay = 300;

const AIMS_TEST_CREDS = {
    access_key_id: 'test-access-key-id',
    secret_key: 'test-secret-key'
};

const LOG_EVENT = {
    "occurredAt": "2024-03-19T05:10:47.055027Z",
    "networkId": "L_686235993220604684",
    "type": "client_vpn",
    "description": "Client VPN negotiation",
    "clientId": null,
    "clientDescription": null,
    "clientMac": "",
    "category": "wired_only_client_vpn",
    "deviceSerial": "Q3FA-KM7T-NYGZ",
    "deviceName": "",
    "eventData": {
      "msg": "<l2tp-over-ipsec-1|97> deleting IKE_SA l2tp-over-ipsec-1[97] between 209.163.151.90[209.163.151.90]...117.200.14.68[192.168.1.6]"
    }
  };

  const NETWORKS = [
    {
      id: 'L_686235993220604684',
      organizationId: '1547127',
      name: 'Alert Logic Test Kit',
      productTypes: [
        'appliance',
        'camera',
        'cellularGateway',
        'sensor',
        'switch',
        'wireless'
      ],
      timeZone: 'America/Los_Angeles',
      tags: [],
      enrollmentString: null,
      url: 'https://n219.meraki.com/Alert-Logic-Test/n/el2PiaBd/manage/usage/list',
      notes: 'Test node',
      isBoundToConfigTemplate: false
    },
    {
      id: 'L_686235993220604720',
      organizationId: '1547127',
      name: 'Alert Logic Test Kit 1 ',
      productTypes: [
        'appliance',
        'camera',
        'cellularGateway',
        'sensor',
        'switch',
        'wireless'
      ],
      timeZone: 'America/Los_Angeles',
      tags: [],
      enrollmentString: null,
      url: 'https://n219.meraki.com/Alert-Logic-Test/n/yNvOHaBd/manage/usage/list',
      notes: 'Test node',
      isBoundToConfigTemplate: false
    }
  ];

const mockInitialStates = [
  { networkId: 'L_686235993220604684', since: '2024-03-20T07:24:34.657Z', until: '2024-03-20T07:25:34.657Z', nextPage: null },
  { networkId: 'L_686235993220604682', since: '2024-03-20T07:24:34.657Z', until: '2024-03-20T07:25:34.657Z', nextPage: null }
];

const FUNCTION_ARN = 'arn:aws:lambda:us-east-1:352283894008:function:test-01-CollectLambdaFunction-2CWNLPPW5XO8';
const FUNCTION_NAME = 'test-TestCollectLambdaFunction-1JNNKQIPOTEST';

module.exports = {
    AIMS_TEST_CREDS: AIMS_TEST_CREDS,
    FUNCTION_ARN: FUNCTION_ARN,
    FUNCTION_NAME: FUNCTION_NAME,
    LOG_EVENT: LOG_EVENT,
    NETWORKS:NETWORKS,
    mockInitialStates:mockInitialStates
};
