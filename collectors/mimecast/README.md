# Mimecast collector
Alert Logic Mimecast AWS Based API Poll (PAWS) Log Collector Library.

# Overview
This repository contains the AWS JavaScript Lambda function and CloudFormation 
Template (CFT) for deploying a log collector in AWS which will poll Mimecast (SEIM, Attachment Protect, URL Protect and Malware Feed) service API to collect and 
forward logs to the Alert Logic CloudInsight backend services.

# Installation

### 1. Api Permissions And Documentation.

1. Authentication and Authorization [Link](https://www.mimecast.com/tech-connect/documentation/api-overview/authentication-and-authorization/).

2. Get SEIM Logs

How to enable SEIM logs API?

The data served by this endpoint is only generated when the requested log type is enabled for your account in the Enhanced Logging section of the Account Settings page in the Administration Console. To enable this feature:

- Log in to the Administration Console.
- Navigate to the Administration | Account | Account Settings menu.
- Locate and select the Enhanced Logging section.
- Enable the log type(s) you would like to get using this endpoint.
- Select Save to apply the change.

In order to use this endpoint the logged in user must be a Mimecast administrator with at least the `Gateway` | `Tracking` | `Read` permission.

[API Documentation](https://www.mimecast.com/tech-connect/documentation/endpoint-reference/logs-and-statistics/get-siem-logs/)

3. Attachment Protect Logs

How to enable Attachment Protect Logs API?

In order to successfully use this endpoint the logged in user must be a Mimecast administrator with at least the `Monitoring` | `Attachment Protection` | `Read` permission.
 
[API Documentation](https://www.mimecast.com/tech-connect/documentation/endpoint-reference/logs-and-statistics/get-attachment-protection-logs/)

4. URL Protect Logs

How to enable URL Protect Logs API?

In order to successfully use this endpoint the logged in user must be a Mimecast administrator with at least the `Monitoring` | `URL Protection` | `Read` permission.
 
[API Documentation](https://www.mimecast.com/tech-connect/documentation/endpoint-reference/logs-and-statistics/get-ttp-url-logs/)
 
 
5. Get Malware Feed
 
How to enable Malware Feed API?

This feed can be used to return identified malware threats at a customer or regional grid level.

Note: This is tied to the Threat Intel feature in the Administration Console, which is currently available as an opt-in early release. Contact our Service Delivery Support Team to have this feature enabled for an account prior to expecting returned data.

In order to successfully use this endpoint the logged in user must be a Mimecast administrator with at least the `Services` | `Gateway` | `Tracking` | `Read` permission.
 
[API Documentation](https://www.mimecast.com/tech-connect/documentation/endpoint-reference/threat-intel/get-feed/)


### 2. CloudFormation Template (CFT)

Refer to [CFN template readme](./cfn/README-MIMECAST.md) for installation instructions.

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
run `npm run create-collector <<name>> <<version>>  <<console log info prefix>>` to create a skeleton collector in the `collectors` folder.

example `npm run create-collector mimecast 1.0.0 MIME`

### 2. Build collector
Clone this repository and build a lambda package by executing:
```
$ git clone https://github.com/alertlogic/paws-collector.git
$ cd paws-collector/collectors/mimecast
$ make deps test package
```

The package name is *al-mimecast-collector.zip*

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

