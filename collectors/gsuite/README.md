# Gsuite collector

Alert Logic Gsuite AWS Based API Poll (PAWS) Log Collector Library.

# Overview

This repository contains the AWS JavaScript Lambda function and CloudFormation
Template (CFT) for deploying a log collector in AWS which will poll 3rd party service API to collect and
forward logs to the Alert Logic CloudInsight backend services.

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

## Creating New Collector Types

run `npm run create-collector <<name>> <<version>> <<logging indentifier>>` to create a skeleton collector in the `collectors` folder.

## Build collector

Clone this repository and build a lambda package by executing:

```
$ git clone https://github.com/alertlogic/paws-collector.git
$ cd paws-collector/collectors/gsuite
$ make deps test package
```

The package name is _al-gsuite-collector.zip_

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
   ```shell
   cp ./local/env.json.tmpl ./local/env.json
   vi ./local/env.json
   make test
   make sam-local
   ```
4. Please see `local/event.json` for the event payload used for local invocation.
   Please write your readme here

## Prerequisites

### G Suite Setup

1. Create a Custom admin role. [Learn more](https://support.google.com/a/answer/1219251?hl=en&ref_topic=4514341)
2. This admin role should have ‘Reports’ privilege.
3. Create an admin user and assign him the role created above.
4. Enable API access for G Suite
   [https://support.google.com/a/answer/60757?authuser=3](https://support.google.com/a/answer/60757?authuser=3)

### Google Cloud platform Setup

1. Create a google cloud project
   [https://console.cloud.google.com/home/dashboard](https://console.cloud.google.com/home/dashboard)
   Note: Preferably create the cloud project with the same user as created in the previous section.
2. Enable ‘Admin API’
   [https://console.cloud.google.com/apis/library/admin.googleapis.com](https://console.cloud.google.com/apis/library/admin.googleapis.com)
3. Create a service account
   [https://developers.google.com/identity/protocols/OAuth2ServiceAccount#creatinganaccount](https://developers.google.com/identity/protocols/OAuth2ServiceAccount#creatinganaccount)
   Note: Preferably download the JSON creds file.
4. Delegating domain-wide authority to the service account
   [https://developers.google.com/identity/protocols/OAuth2ServiceAccount#delegatingauthority](https://developers.google.com/identity/protocols/OAuth2ServiceAccount#delegatingauthority)
   Note: In Step 6 add scope as : https://www.googleapis.com/auth/admin.reports.audit.readonly

### Setting up the Environment

1. Set `$ export CREDS=$(cat /credential/file/from/previous/step.json)`
2. Set `$ export EMAIL_ID="<replace with email set in first step>"`
3. Set `$ export APPLICATION_NAMES="login,admin"`
4. Then run
   ```shell
   $ node cli_gsuite.js --paws_creds=$CREDS --paws_email_id=$EMAIL_ID --paws_scopes=$SCOPE --paws_application_names=$APPLICATION_NAMES
   ```
