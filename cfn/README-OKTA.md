# okta-collector.template

Alert Logic OKTA Log Collector CloudFormation template.

 
# Before you begin

This procedure requires administrative permissions in AWS and your Alert Logic 
Cloud Insight account. You also need to download the Alert Logic custom [CFT](https://github.com/alertlogic/paws-collector/blob/master/cfn/okta-collector.template).

Windows systems also require PowerShell version 3.0 or later. If you have an earlier version of PowerShell, we suggest you [upgrade it](https://docs.microsoft.com/en-us/powershell/scripting/setup/installing-windows-powershell#upgrading-existing-windows-powershell) to version 3.0 or later. 

# Installation

Currently, we support US regions only: `us-east-1`, `us-east-2`, `us-west-1`, 
`us-west-2`.

## Enable VPC Log Group
1. Log into AWS console.
1. Enable AWS VPC Flow Logs by choosing *VPC -> Your VPCs -> Flow Logs*. 
1. Click on the *Create Flow Log* button and choose a name of *CloudWatch Logs Group* which 
will be later used as a trigger for your lambda function. 

## CFN Template
1. Go to AWS CloudFormation 
1. Click on *Create Stack* and use following S3 URL with cfn template.
`https://s3.amazonaws.com/alertlogic-collectors-us-east-1/cfn/okta-collector.template`
1. In the next step, you will need:
   - `Stack name` - Any name you have used for creating an AWS stack
   - `AlApiEndpoint` - use predefined `api.global-services.global.alertlogic.com` 
   - `AlDataResidency` - use `default`
   - `AccessKeyId` - `access_key_id` returned from AIMS
   - `SecretKey` - `secret_key` returned from AIMS
   - `Okta API Endpoint` - Okta endpoint
   - `Okta Token` - Okta token
1. Continue to finish the stack.


# Verification 
- Go to the newly created lambda function and select Monitoring. 
There should not be any errors on Invocation errors.
- Go to the CloudWatch Logs and select `/aws/lambda/<function-name>` Log 
Group. Open the newest Log Stream and verify it doesn't contain any errors.


# Known issues


