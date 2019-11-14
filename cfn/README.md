# paws-collector templates

Alert Logic AWS Based API Poll (PAWS) Log Collector templates.

# Overview

This folder contains CloudFormation templates (CFT) for deploying a OKTA collector 
in AWS account which will collect and forward logs to the Alert Logic CloudInsight 
backend services.

# Before you start

Before you start installing a new collector, you need to get access key and secret key from AIMS. 
Please follow the [instructions](https://github.com/alertlogic/cwe-collector/blob/integration/cfn/README-GD.md#alert-logic-access-key-creation) to get AIMS keys for your Alert Logic customer.


# Supported PAWS Logs Collectors

[OKTA Logs Collection](./README-OKTA.md)

# Useful Links

- [Alert Logic AIMs service API](https://console.cloudinsight.alertlogic.com/api/aims/)
- [How to monitor AWS Lambda functions](http://docs.aws.amazon.com/lambda/latest/dg/monitoring-functions.html)
