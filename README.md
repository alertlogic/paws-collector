# paws-collector

[![Build Status](https://secure.travis-ci.org/alertlogic/al-aws-collector-js.png?branch=master)](http://travis-ci.org/alertlogic/al-aws-collector-js) ![ALPS build](https://ci.pipelineservices.alertlogic.com/v1/badges/alertlogic/paws-collector/master?github=true)

Alert Logic AWS Based API Poll (PAWS) Log Collector Library.

# Overview
This repository contains the AWS  JavaScript Lambda function and CloudFormation 
Template (CFT) for deploying a log collector in AWS which will poll a 3rd party service API to collect and 
forward logs to the Alert Logic CloudInsight backend services.

# Installation

Refer to the [CF template readme](./cfn/README.md) for installation instructions.


# How it works

## Update Trigger

The `Updater` is a timer triggered function that runs a deployment sync operation 
every 12 hours in order to keep the collector lambda function up to date.
The `Updater` syncs from the Alert Logic S3 bucket that contained the package used for the initial deployment.

## Collection Trigger

The `Collector` function is an AWS lambda function which is triggered by SQS which contains a collection state message.
During each invocation the function polls the specified 3rd party service log API and sends retrieved data to the AlertLogic `Ingest` service for further processing.

## Checkin Trigger

The `Checkin` Scheduled Event trigger is used to report the health and status of 
the Alert Logic AWS lambda collector to the `Azcollect` back-end service based on 
an AWS Scheduled Event that occurs every 15 minutes.


# Development

## Creating New Collector Types
run `npm run create-collector <<name>> <<version>> <<log-prefix>>` to create a skeleton collector in the `collectors` folder.

## Build
Clone this repository and build a lambda package by executing:
```
$ git clone https://github.com/alertlogic/paws-collector.git
$ cd paws-collector
$ make deps test package
```

## Build collector for 3rd party API
Clone this repository and build a lambda package by executing:
```
$ git clone https://github.com/alertlogic/paws-collector.git
$ cd paws-collector/collectors/<collector-name>
$ make deps test package
```

The package name is *al-<collector-name>-collector.zip*

## Debugging

To get a debug trace, set a Node.js environment variable called DEBUG and
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
AWS SAM uses the `default` credentials profile from `~/.aws/credentials`.

  1. Encrypt the key using aws cli:
```
aws kms encrypt --key-id KMS_KEY_ID --plaintext AIMS_SECRET_KEY
```
  2. Include the encrypted token, and `KmsKeyArn`, used in Step 1, inside the SAM yaml:
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
