# Auth0 collector
Alert Logic Auth0 AWS Based API Poll (PAWS) Log Collector Library.

# Overview
This repository contains the AWS JavaScript Lambda function and CloudFormation 
Template (CFT) for deploying a log collector in AWS which will poll Auth0 Logs service API to collect and forward logs to the Alert Logic CloudInsight backend services.

# Installation

### 1. How to obtain an API Secret Key and API ID

1. In the APIs section of the Auth0 dashboard, click Create API.<br /><br />
![ScreenShot](./docs/auth0_1.png)
2. Provide a name and an identifier for your API, for example, https://quickstarts/api. You will use the identifier as an audience later, when you are configuring the Access Token verification. Leave the Signing Algorithm as RS256.<br /><br />
![ScreenShot](./docs/auth0_2.png)<br /><br />
3. Permissions let you define how resources can be accessed on behalf of the user with a given access token. For example, you might choose to grant read access to the messages resource if users have the manager access level, and a write access to that resource if they have the administrator access level.
You can define allowed permissions in the Permissions tab of the Auth0 Dashboard's APIs section. <br /><br />
![ScreenShot](./docs/auth0_3.png)<br /><br />
4. In the APIs section of the Auth0 dashboard, click on Auth0 Management API.<br /><br /> 
![ScreenShot](./docs/auth0_4.png)<br /><br />
5. In Auth0 Management API click on Machine to Machine Applications.<br /><br />
![ScreenShot](./docs/auth0_5.png)<br /><br />
6. Authorize the application(which you are created) and select permissions read:logs.<br /><br />
![ScreenShot](./docs/auth0_6.png)<br /><br />
7. On the Applications page of the Auth0 Dashboard, locate your Application and click its name to view the available settings. The generated client ID and client secret are found here.<br /><br />
![ScreenShot](./docs/auth0_7.png)<br /><br />
![ScreenShot](./docs/auth0_8.png)<br /><br />

### 2. API Docs

1. [Auth0_Node_Library](https://www.npmjs.com/package/auth0)
2. [Setup_API](https://auth0.com/docs/get-started/set-up-apis)
3. [Auth0_Logs](https://auth0.com/docs/logs)

### 3. CloudFormation Template (CFT)

Refer to [CF template readme](./cfn/README-AUTH0.md) for installation instructions.

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

example `npm run create-collector auth0 1.0.0 AUTZ`

### 2. Build collector
Clone this repository and build a lambda package by executing:
```
$ git clone https://github.com/alertlogic/paws-collector.git
$ cd paws-collector/collectors/auth0
$ make deps test package
```

The package name is *al-auth0-collector.zip*

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

