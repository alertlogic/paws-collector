# Crowdstrike collector
Alert Logic Crowdstrike AWS Based API Poll (PAWS) Log Collector Library.

# Overview
This repository contains the AWS JavaScript Lambda function and CloudFormation 
Template (CFT) for deploying a log collector in AWS which will poll Crowdstrike(Incident, Detection) service API to collect and 
forward logs to the Alert Logic CloudInsight backend services.

# Installation

### 1. How to obtain an API Secret Key and API ID

#### Before you begin

Role required: CrowdStrike Falcon administrator

#### Procedure

1. On the CrowdStrike Falcon Platform, navigate to API Clients and Keys.
2. In the OAuth2 API Clients table, click Add new API client.
3. Enter the following details to define your API client:

| Field        | Description           |
| ------------- |:-------------|
| Client Name     | Enter the client name. This is a required field. |
| Description     | Enter the description for the client name.      |
| API Scopes |<ul>Defining the scopes is required. Enable the following API scopes:<li>Enable Read scope for Incident API</li><li>Enable Read scope for Detection API</li></ul>|

4. Click Add to save the API client and generate the client ID and secret key.

### 2. API Docs
1. [Authentication](https://developer.crowdstrike.com/crowdstrike/reference/oauth2-1#oauth2accesstoken-1)
2. [Incident](https://developer.crowdstrike.com/crowdstrike/reference/incidents-1#queryincidents-1)
3. [Detection](https://developer.crowdstrike.com/crowdstrike/reference/detects-1#querydetects-1)

API URL required for Crowdstrike collector
https://api.crowdstrike.com/

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

## Creating New Collector Types
run `npm run create-collector <<name>> <<version>>` to create a skeleton collector in the `collectors` folder.

## Build collector
Clone this repository and build a lambda package by executing:
```
$ git clone https://github.com/alertlogic/paws-collector.git
$ cd paws-collector/collectors/crowdstrike
$ make deps test package
```

The package name is *al-crowdstrike-collector.zip*

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

