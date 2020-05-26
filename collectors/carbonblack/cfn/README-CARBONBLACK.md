# carbonblack-collector.template

Alert Logic Carbonblack Log Collector CloudFormation template.

 
# Before you begin

This procedure requires administrative permissions in AWS and your Alert Logic 
Cloud Insight account. You also need to download the Alert Logic custom [CFT](https://github.com/alertlogic/paws-collector/blob/master/collectors/carbonblack/cfn/carbonblack-collector.template).


# Installation

Currently, we support US regions only: `us-east-1`, `us-east-2`, `us-west-1`, 
`us-west-2`.


## CFN Template
1. Go to AWS CloudFormation 
1. Click on *Create Stack* and use following S3 URL with cfn template.
`https://s3.amazonaws.com/alertlogic-collectors-us-east-1/cfn/carbonblack-collector.template`
1. In the next step, you will need:
   - `Stack name` - Any name you have used for creating an AWS stack
   - `AlApiEndpoint` - use predefined `api.global-services.global.alertlogic.com` 
   - `AlApplicationId` - use `Carbonblack` (Alert Logic Application Id for collector logs)  
   - `AlDataResidency` - use `default`
   - `AlertlogicAccessKeyId` - `access_key_id` returned from AIMS
   - `AlertlogicCustomerId` - Optional. Alert Logic customer ID which collected data should be reported for. If not set customer ID is derived from AIMs tokens
   - `AlertlogicSecretKey` - `secret_key` returned from AIMS
   - `CarbonblackAPINames` - Define API names. Please pass JSON formatted list. Possible values are ["AuditLogEvents", "SearchAlerts", "SearchAlertsCBAnalytics", "SearchAlertsVmware", "SearchAlertsWatchlist"]
   - `CarbonblackClientId` - Carbonblack Client ID 
   - `CarbonblackEndpoint` - Carbonblack Endpoint
   - `CarbonblackOrgKey` - Carbonblack organisation key
   - `CarbonblackSecret` - Carbonblack Secret 
   - `CollectionStartTs` - example `2019-11-21T16:00:00Z` Timestamp when log collection starts
   - `CollectorId` - default `none` Optional. A collector UUID if known.
   - `PackagesBucketPrefix` - example `alertlogic-collectors` S3 bucket name prefix where collector packages are located.
   - `PawsCollectorTypeName` - use `carbonblack`

1. Continue to finish the stack.


# Verification 
- Go to the newly created lambda function and select Monitoring. 
There should not be any errors on Invocation errors.
- Go to the CloudWatch Logs and select `/aws/lambda/<function-name>` Log 
Group. Open the newest Log Stream and verify it doesn't contain any errors.


# Known issues
