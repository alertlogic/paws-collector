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

Dependency updates, vulnerability fixes, and Node.js runtime checks are
automated via GitHub Actions and Dependabot. All PRs require manual review —
**no auto-merge**.

### What is automated

- **Root library dependency audit + fix** — [.github/workflows/deps-paws-update.yml](.github/workflows/deps-paws-update.yml)
- **Per-collector dependency audit + fix** — [.github/workflows/collector-deps-audit.yml](.github/workflows/collector-deps-audit.yml)
- **Mechanical pin of `@alertlogic/paws-collector` across collectors after a root release** — [.github/workflows/collector-paws-pin.yml](.github/workflows/collector-paws-pin.yml)
- **AWS Lambda Node.js runtime bump** — [.github/workflows/lambda-runtime-sync.yml](.github/workflows/lambda-runtime-sync.yml)
- **Dependabot** — weekly version + security updates for root npm and GitHub Actions ([.github/dependabot.yml](.github/dependabot.yml))
- **CodeQL, dependency review, code coverage** — [.github/workflows/codeql.yml](.github/workflows/codeql.yml), [.github/workflows/dependency-review.yml](.github/workflows/dependency-review.yml), [.github/workflows/code-coverage.yml](.github/workflows/code-coverage.yml)

### Workflow Dependency Diagram

```
Dependabot (weekly, Mon 09:00 UTC)
  ├─► npm PR for root package.json           (label: deps-paws-lib)
  └─► PR for GitHub Actions version updates  (label: deps-actions)

Scheduled cron Mon+Thu 09:00 UTC | push: master | workflow_dispatch
        │
        ├──► lambda-runtime-sync.yml
        │       1. Fetches AWS Lambda runtimes docs
        │       2. Detects new nodejs<N>.x supported runtime
        │       3. Updates local/sam-template.yaml, cfn templates, ps_spec.yml,
        │          .nvmrc, all collectors/*/local/sam-template.yaml
        │       4. Bumps patch version in root + all collector package.json
        │       └─► Opens/updates PR on branch chore/node-runtime-update
        │           (label: runtime-update)
        │
        └──► deps-paws-update.yml
                1. npm ci + npm audit fix        (safe: patch/minor only)
                2. update-overrides.js           (transitive vulns)
                3. If high/critical remain → snapshot, then npm audit fix --force
                4. npm test; if tests break after --force → revert snapshot & retest
                5. If package.json changed → bump patch version
                6. verify-fix.js gate: open PR only if files changed;
                   draft if tests failed or high/critical remain, else ready
                └─► Opens/updates PR on branch fix/paws-deps-update
                    (labels: deps-paws-lib [+tests-failing] [+partial-fix])
                             │
                             │ (PR reviewed & merged → push:master triggers ↓)
                             ▼
                    collector-paws-pin.yml
                      For each collectors/<name>/ (except template/):
                        1. Pins @alertlogic/paws-collector to new root version
                        2. Bumps patch version
                      └─► Opens/updates PR on branch chore/collector-paws-pin
                          (label: paws-pin)

Daily cron 08:00 UTC | workflow_dispatch (optional single collector)
        │
        └──► collector-deps-audit.yml  (matrix, per collector)
                1. npm install
                2. npm audit fix                 (safe: patch/minor only)
                3. update-overrides.js
                4. If high/critical remain → snapshot, then npm audit fix --force
                5. Remove ephemeral package-lock.json (never committed)
                6. npm test; if --force broke tests → revert snapshot & retest
                7. If package.json changed → bump patch version
                8. verify-fix.js gate
                └─► Opens/updates one PR per collector on branch
                    fix/deps-collector-<name>
                    (labels: deps-collectors [+tests-failing] [+partial-fix])
```

### How to use

- **Automatic runs** — nothing to do; the workflows run on their schedules and
  open (or refresh) PRs. Review, approve, and merge manually.
- **Trigger on demand** — from the **Actions** tab pick the workflow and click
  **Run workflow**. `collector-deps-audit` accepts an optional `collector`
  input to audit a single collector (leave blank for all).
- **Reading the PR body** — each PR includes a summary table with tests
  passed/failed, high/critical counts remaining, the new version, dependency
  changes, and vulnerabilities addressed.
- **Labels to watch**
    - `deps-paws-lib` — root library audit fix
    - `deps-collectors` — per-collector audit fix
    - `paws-pin` — mechanical version pin across collectors
    - `runtime-update` — Node.js Lambda runtime bump
    - `deps-actions` — Dependabot GitHub Actions updates
    - `tests-failing` — tests broke on the branch; **do not merge** until fixed
    - `partial-fix` — some high/critical vulns are unresolved (usually needs a
      manual breaking-change upgrade)

### Behavior worth knowing

- **Version bumps are always patch.** [.github/scripts/bump-version.js](.github/scripts/bump-version.js)
  increments only the third semver segment, regardless of whether the
  underlying dependency change was a patch, minor, or a `--force` major bump.
  Minor/major bumps of the collector version itself are done manually.
- **`--force` is used only when high/critical remain** after safe fixes; it is
  never used to resolve moderate/low advisories. If `--force` breaks tests,
  the workflow restores the pre-force `package.json` (and lockfile for the
  root repo) and re-runs tests so the PR reflects a known-good state.
- **PRs are updated in place, not duplicated.** Each workflow uses a
  deterministic branch (e.g. `fix/deps-collector-<name>`, `fix/paws-deps-update`,
  `chore/node-runtime-update`, `chore/collector-paws-pin`) and does
  `gh pr view "$branch"` first. If a PR exists it is edited (title, body,
  draft/ready state) via `--force-with-lease`; only otherwise is a new PR
  opened.
- **PRs open only when meaningful.** [.github/scripts/verify-fix.js](.github/scripts/verify-fix.js)
  skips opening a PR when nothing changed, marks it **draft** when tests fail
  or high/critical vulnerabilities remain, and **ready-for-review** only when
  the audit is clean and tests pass.
- **Collector lockfiles are ephemeral.** Collectors intentionally don't commit
  `package-lock.json` (see `collectors/collector.mk clean`); the audit
  workflow removes it before staging so a lockfile is never leaked into a PR.

### Workflow Files

| File | Purpose | Trigger |
|---|---|---|
| [.github/workflows/lambda-runtime-sync.yml](.github/workflows/lambda-runtime-sync.yml) | Detects AWS Lambda Node.js runtime upgrades and updates all version references | push:master, cron Mon+Thu 09:00, dispatch |
| [.github/workflows/deps-paws-update.yml](.github/workflows/deps-paws-update.yml) | Audits and fixes root `@alertlogic/paws-collector` dependencies | push:master, cron Mon+Thu 09:00, dispatch |
| [.github/workflows/collector-paws-pin.yml](.github/workflows/collector-paws-pin.yml) | Pins `@alertlogic/paws-collector` across all collectors after a root release | push:master (root `package.json` change), dispatch |
| [.github/workflows/collector-deps-audit.yml](.github/workflows/collector-deps-audit.yml) | Per-collector daily dependency audit + fix (one PR per collector) | cron daily 08:00, dispatch (optional `collector` input) |
| [.github/workflows/codeql.yml](.github/workflows/codeql.yml) | CodeQL static analysis | push, PR, schedule |
| [.github/workflows/dependency-review.yml](.github/workflows/dependency-review.yml) | Blocks PRs that introduce vulnerable or disallowed dependencies | pull_request |
| [.github/workflows/code-coverage.yml](.github/workflows/code-coverage.yml) | Publishes root test coverage | push, PR |
| [.github/dependabot.yml](.github/dependabot.yml) | Dependabot config for root npm + GitHub Actions | Weekly, Mon 09:00 UTC |

### Scripts

| File | Purpose |
|---|---|
| [.github/scripts/check-node-version.js](.github/scripts/check-node-version.js) | Fetches AWS docs, detects new Lambda runtime, patches all Node.js version references |
| [.github/scripts/update-overrides.js](.github/scripts/update-overrides.js) | Runs `npm audit` and updates the `overrides` section in any package.json (supports `--cwd`) |
| [.github/scripts/bump-version.js](.github/scripts/bump-version.js) | Increments the patch semver in a `package.json` file (patch only — never minor/major) |
| [.github/scripts/verify-fix.js](.github/scripts/verify-fix.js) | Post-fix gate: decides whether a PR should be opened and whether it's ready or draft, based on file changes, residual high/critical vulns, and test outcome |
| [.github/scripts/audit-summary.js](.github/scripts/audit-summary.js) | Produces the dependency-change and vulnerability tables that go into the PR body |


