# O365 collector

Alert Logic Office365 AWS Based API Poll (PAWS) Log Collector Library.

# Overview
This repository contains the AWS JavaScript Lambda function and CloudFormation 
Template (CFT) for deploying a log collector in AWS which will poll 3rd party service API to collect and 
forward logs to the Alert Logic CloudInsight backend services.

## Register a New O365 Web Application in O365

In the Office 365 portal, you must register a new Office 365 web application to collect Office 365 logs. 

**To register an Office 365 web application to collect logs:**

1. Log into the [Office 365 portal](https://portal.office.com) as an Active Directory tenant administrator.
1. Navigate to `Admin Centers` and then `Azure AD`.
1. In the left navigation area, click `Azure Active Directory`, and then select `App Registrations`.
1. Click `+ New application registration` and then provide the following information:
    * `Name`- Provide a name for the new application (For example `alo365collector`).
    * Select Single tenant option for supported account types.
    * Leave the Redirect URI blank.
1. Click Register 
1. From the `All applications` tab on the `App registration (Preview)` blade, select `All apps`, and then click the application name you created. 
1. Note the `Application ID`, for example, `a261478c-84fb-42f9-84c2-de050a4babe3`

## Set Up the Required Active Directory Security Permissions

1. On the main panel under the new application, select `View API Permissions`, and then click `+ Add`.
1. Locate the `Office 365 Management APIs`, and then click `Select`.
1. In `Application permissions`, expand then select `ActivityFeed.Read`, `ActivityFeed.ReadDlp`, `ActivityReports.Read`(both), `ServiceHealth.Read`, and `ThreatIntelligence.Read`(both). 
1. Click `Select`, and then click `Done`. 
1. Click `Grant Permissions`, and then click `Yes`. 
**Note:** Only the Active Directory tenant administrator can grant permissions to an Azure Active Directory application.
1. On the `Settings` panel for the application, select `Certificated & Secrets`.
1. Select the `+ New client secret` button.
1. Type a key `Description`, and then set `Duration` to `Never expires`. 
1. Click `Add`.
**Note:** Save the key value, which you need during ARM template deployment.
1. From the `Registered App` blade, click the link under `Managed application in local directory`, and then click `Properties`.
1. Get the `Service Principal ID` associated with the application. (The `Service Principal ID`is labeled as `Object ID` on the properties page.)
**Caution:** This ID is not the same `Object ID` found under the `Registered app` view or under the `Settings`.
# Installation

Refer to [CF template readme](./cfn/README.md) for installation instructions.

# How it works

## Update Trigger

The `Updater` is a timer triggered function that runs a deployment sync operation 
every 12 hours in order to keep the collector lambda function up to date.
The `Updater` syncs from the Alert Logic S3 bucket where you originally deployed from.

## Collection Trigger

The `Collector` function is an AWS lambda function which is triggered by SQS which contains collection state message.
During each invocation the function polls 3rd party service log API and sends retrieved data to 
AlertLogic `Ingest` service for further processing.

## Checkin Trigger

The `Checkin` Scheduled Event trigger is used to report the health and status of 
the Alert Logic AWS lambda collector to the `Azcollect` back-end service based on 
an AWS Scheduled Event that occurs every 15 minutes.


# Development

## Build collector
Clone this repository and build a lambda package by executing:
```
$ git clone https://github.com/alertlogic/paws-collector.git
$ cd paws-collector/collectors/o365
$ make deps test package
```

The package name is *al-o365-collector.zip*

## Debugging

To get a debug trace, set an Node.js environment variable called DEBUG and
specify the JavaScript module/s to debug.

E.g.

```
export DEBUG=*
export DEBUG=index
```

Or set an environment variable called "DEBUG" in your AWS stack (using the AWS 
console) for a collector AWS Lambda function, with value "index" or "\*".

See [debug](https://www.npmjs.com/package/debug) for further details.

## Invoking locally

In order to invoke lambda locally please follow the [instructions](https://docs.aws.amazon.com/lambda/latest/dg/sam-cli-requirements.html) to install AWS SAM.
AWS SAM uses `default` credentials profile from `~/.aws/credentials`.

  1. Encrypt the key using aws cli:
```
aws kms encrypt --key-id KMS_KEY_ID --plaintext AIMS_SECRET_KEY
```
  2. Include the encrypted token, and `KmsKeyArn` that you used in Step 1 inside my SAM yaml:
```
    KmsKeyArn: arn:aws:kms:us-east-1:xxx:key/yyy
    Environment:
        Variables:
```
  3. Fill in environment variables in `env.json` (including encrypted AIMS secret key) and invoke locally:

```
cp ./local/env.json.tmpl ./local/env.json
vi ./local/env.json
make test
make sam-local
```
  4. Please see `local/event.json` for the event payload used for local invocation.
Please write your readme here
