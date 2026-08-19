# paws-collector

[![Build Status](https://secure.travis-ci.org/alertlogic/al-aws-collector-js.png?branch=master)](http://travis-ci.org/alertlogic/al-aws-collector-js) ![ALPS build](https://ci.pipelineservices.alertlogic.com/v1/badges/alertlogic/paws-collector/master?github=true)

Alert Logic AWS Based API Poll (PAWS) Log Collector Library.

# Overview
This repository contains the AWS  JavaScript Lambda function and CloudFormation 
Template (CFT) for deploying a log collector in AWS which will poll a 3rd party service API to collect and 
forward logs to the Alert Logic CloudInsight backend services.

# Documentation

- [Architecture](./docs/ARCHITECTURE.md) – high-level design of the PAWS
  collector framework (triggers, state, lifecycle).
- [Third-party API Inventory](./docs/collector-api-inventory.md) – canonical,
  source-of-truth list of every third-party REST endpoint and SDK call made
  by each collector. Use it instead of vendor links scattered across individual
  collector READMEs.

All examples in the API inventory are sanitized (placeholders only). Do not
commit real tenant identifiers, org keys, hostnames tied to a customer, or any
authentication artifacts.

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


## Build artifact 

  1. To build the single/individual collector : 
      - a. Update `ALPS_SERVICE_VERSION` from collector package.json version.
      - b. Trigger the phrase base on the collector name once the pr is approved.
    ex. to create artifact for auth0 ,phrase will be `build-collector-auth0`

  2. To build all the collectors:
    There is two way of building the all collector as follow:
      1. Update the `ALPS_SERVICE_VERSION` for each collector as per package.json and trigger the common prase `build-collectors` once pr is approved.
      
          ***OR***
      
      2. After pr is merge to master branch ,create the tag, which will build the single artifact for all collectors.

## Dependency & Runtime Automation

Dependency updates and Node.js runtime checks are automated via GitHub Actions
and Dependabot. All PRs require manual review — **no auto-merge**.

### Workflow Dependency Diagram

```
Dependabot (Mon & Thu, 09:00 UTC)
  └─► Raises npm PR for root package.json (label: deps-paws-lib)
  └─► Raises PR for GitHub Actions version updates (label: deps-actions)

Scheduled cron Mon   |  push: master  |  workflow_dispatch
        │
        ├──► lambda-runtime-sync.yml
        │       1. Fetches AWS Lambda runtimes docs
        │       2. Detects new nodejs<N>.x supported runtime
        │       3. Updates: local/sam-template.yaml, cfn templates,
        │                   ps_spec.yml, code-coverage.yml,
        │                   all collectors/*/local/sam-template.yaml
        │       4. Bumps patch version in root + all collector package.json files
        │       └─► Opens PR for review  (label: runtime-update)
        │
        └──► deps-paws-update.yml
                1. npm ci + npm audit fix (safe fixes only, no --force)
                2. update-overrides.js — fixes transitive vulnerabilities
                3. Bumps patch version in root package.json
                └─► Opens PR for review  (label: deps-paws-lib)
                             │
                             │  (PR reviewed & merged → push to master triggers)
                             ▼
                    collector-deps-sync.yml
                      For each collector in collectors/ (except template/):
                        1. Pins @alertlogic/paws-collector to new root version
                        2. npm audit fix + update-overrides.js
                        3. Bumps patch version in each collector package.json
                      └─► Opens one consolidated PR for review  (label: deps-collectors)
```

### Workflow Files

| File | Purpose | Trigger |
|---|---|---|
| [.github/workflows/lambda-runtime-sync.yml](.github/workflows/lambda-runtime-sync.yml) | Detects AWS Lambda Node.js runtime upgrades and updates all version references | push:master, cron Mon+Thu, dispatch |
| [.github/workflows/deps-paws-update.yml](.github/workflows/deps-paws-update.yml) | Audits and fixes root `@alertlogic/paws-collector` dependencies | push:master, cron Mon+Thu, dispatch |
| [.github/workflows/collector-deps-sync.yml](.github/workflows/collector-deps-sync.yml) | Syncs all collector dependencies after root version bumps | push:master (detects version change), dispatch |
| [.github/dependabot.yml](.github/dependabot.yml) | Dependabot config for root npm + GitHub Actions | Mon & Thu schedule |

### Scripts

| File | Purpose |
|---|---|
| [.github/scripts/check-node-version.js](.github/scripts/check-node-version.js) | Fetches AWS docs, detects new Lambda runtime, patches all node version references |
| [.github/scripts/update-overrides.js](.github/scripts/update-overrides.js) | Runs `npm audit` and updates the `overrides` section in any package.json (supports `--cwd`) |
| [.github/scripts/bump-version.js](.github/scripts/bump-version.js) | Increments the patch semver in a package.json file |


