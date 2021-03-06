# Carbonblack collector
Alert Logic Carbonblack AWS Based API Poll (PAWS) Log Collector Library.

# Overview
This repository contains the AWS JavaScript Lambda function and CloudFormation 
Template (CFT) for deploying a log collector in AWS which will poll Carbonblack (Audit Log Events, Search Alerts, Search Alerts CBAnalytics, Search Alerts Watchlist) service API to collect and 
forward logs to the Alert Logic CloudInsight backend services.

# Installation

### 1. How to obtain an API Secret Key and API ID

1. Log into your Carbon Black Cloud Organization.
2. Navigate to Settings > API Access.
3. Click “Add API Key”.
4. Configure Name, Access Level type, etc.
5. Obtain your API Secret Key and API ID pair.

For Audit Log Events API use access level - API

![ScreenShot](./docs/carbonblack_credentials_api.png)

For all Search Request API use access level (custom) and custom access level (View All)
This access level is used for collecting Alerts.

![ScreenShot](./docs/carbonblack_credentials_custom.png)

### 2. API Docs

1. [Authentication](https://developer.carbonblack.com/reference/carbon-black-cloud/authentication/)
2. [AuditLogEvents](https://developer.carbonblack.com/reference/carbon-black-cloud/cb-defense/latest/rest-api/)
3. [SearchRequest](https://developer.carbonblack.com/reference/carbon-black-cloud/platform/latest/alerts-api/)


API URLs required for CarbonBlack collector

| Environment (Region)   | URL                                  |
|------------------------|--------------------------------------|
| Prod01 (N Am)          | https://api.confer.net               |
| Prod02 (N Am)          | https://api5.conferdeploy.net        |
| Prod05 (N Am)          | https://api-prod05.conferdeploy.net  |
| Prod06 (EU)            | https://api-prod06.conferdeploy.net  |
| ProdNRT (Asia Pacific) | https://api-prodnrt.conferdeploy.net |

### 3. CloudFormation Template (CFT)

Refer to [CF template readme](./cfn/README-CARBONBLACK.md) for installation instructions.

# How it works

### 1. Update Trigger

The `Updater` is a timer triggered function that runs a deployment sync operation 
every 12 hours in order to keep the collector lambda function up to date.
The `Updater` syncs from the Alert Logic S3 bucket where you originally deployed from.

### 2. Collection Trigger

The `Collector` function is an AWS lambda function which is triggered by SQS which contains collection state message.
During each invocation the function polls 3rd party service log API and sends retrieved data to 
AlertLogic `Ingest` service for further processing.

### 3. Checkin Trigger

The `Checkin` Scheduled Event trigger is used to report the health and status of 
the Alert Logic AWS lambda collector to the `Azcollect` back-end service based on 
an AWS Scheduled Event that occurs every 15 minutes.


# Development

### 1. Creating New Collector Types
run `npm run create-collector <<name>> <<version>> <<console log info prefix>>` to create a skeleton collector in the `collectors` folder.

example `npm run create-collector carbonblack 1.0.0 CABL`

### 2. Build collector
Clone this repository and build a lambda package by executing:
```
$ git clone https://github.com/alertlogic/paws-collector.git
$ cd paws-collector/collectors/carbonblack
$ make deps test package
```

The package name is *al-carbonblack-collector.zip*

### 3. Debugging

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


### 4. Invoking locally

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

### 5. Removed Search alert vmware 
1. Carbon black search alert api not supporting the vmware api.
2. One new api (i.e devicecontrol) get added in CB search alert api [doc](https://developer.carbonblack.com/reference/carbon-black-cloud/platform/latest/alerts-api/#alert-search), but we are not yet supporting this.
