# gsuite-collector.template

Alert Logic Gsuite Log Collector CloudFormation template.

 
# Before you begin

This procedure requires administrative permissions in AWS and your Alert Logic 
Cloud Insight account. You also need to download the Alert Logic custom [CFT](https://github.com/alertlogic/paws-collector/blob/master/collectors/gsuite/cfn/gsuite-collector.template).


# Installation

Currently, we support US regions only: `us-east-1`, `us-east-2`, `us-west-1`, 
`us-west-2`.


## CFN Template
1. Go to AWS CloudFormation 
1. Click on *Create Stack* and use following S3 URL with cfn template.
`https://s3.amazonaws.com/alertlogic-collectors-us-east-1/cfn/gsuite-collector.template`
1. In the next step, you will need:
   - `Stack name` - Any name you have used for creating an AWS stack
   - `AlApiEndpoint` - use predefined `api.global-services.global.alertlogic.com` 
   - `AlApplicationId` - use `gsuite` (Alert Logic Application Id for collector logs)  
   - `AlDataResidency` - use `default`
   - `AlertlogicAccessKeyId` - `access_key_id` returned from AIMS
   - `AlertlogicCustomerId` - Optional. Alert Logic customer ID which collected data should be reported for. If not set customer ID is derived from AIMs tokens
   - `AlertlogicSecretKey` - `secret_key` returned from AIMS
   - `CollectionStartTs` - example `2019-11-21T16:00:00Z` Timestamp when log collection starts
   - `CollectorId` - default `none` Optional. A collector UUID if known.
   - `GsuiteApplicationNames` - Define Application name. Please pass JSON formatted list. Possible values are ["login", "admin", "access_transparency", "calendar", "drive", "gplus", "groups", "groups_enterprise", "mobile", "rules", "token", "user_accounts","context_aware_access", "chrome", "alerts"]
   - `GsuiteClientSecret` - The JSON key for the Gsuite Client secret
   - `GsuiteEmailId` - Gsuite Email ID
   - `GsuiteScope` - Define Scope. Possible values are ["https://www.googleapis.com/auth/admin.reports.usage.readonly","https://www.googleapis.com/auth/admin.reports.audit.readonly","https://www.googleapis.com/auth/apps.alerts"]
   - `PackagesBucketPrefix` - example `alertlogic-collectors` S3 bucket name prefix where collector packages are located.
   - `PawsAuthType` - use `ssws`

1. Continue to finish the stack.


# Verification 
- Go to the newly created lambda function and select Monitoring. 
There should not be any errors on Invocation errors.
- Go to the CloudWatch Logs and select `/aws/lambda/<function-name>` Log 
Group. Open the newest Log Stream and verify it doesn't contain any errors.


# Known issues
