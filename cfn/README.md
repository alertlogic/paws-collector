# paws-collector templates

Alert Logic AWS Based API Poll (PAWS) Log Collector templates.

# Overview

This folder contains CloudFormation templates (CFT) for deploying a PAWS log collector 
in an AWS account which will collect and forward logs to the Alert Logic CloudInsight 
backend services.

# Before you start

Before you start installing a new collector, you need to get an access key and a secret key from AIMS. 

Windows systems also require PowerShell version 3.0 or later. If you have an earlier version of PowerShell, we suggest you [upgrade it](https://docs.microsoft.com/en-us/powershell/scripting/setup/installing-windows-powershell#upgrading-existing-windows-powershell) to version 3.0 or later.

Please follow the instructions below to get AIMS keys for your Alert Logic customer.

## Alert Logic Access key creation

### Verify permissions

Log into the Cloud Insight console as an administrator [here](https://console.cloudinsight.alertlogic.com/#/login) to verify administrator permissions:

1. In the Cloud Insight console, click the user name at the top-right corner.
1. In the drop-down menu, click **Users**.
1. Select the user in `AIMS User` section. **Note:** you can start typing a name in the search box to find the appropriate user.
1. Verify the `user role` as listed under `Edit an AIMS User` has the `Administrator` role selected.

### Key creation

Use the instructions below that match your operating system: Unix (MacOS, Linux) or Windows.

#### Unix (MacOS, Linux)

The following procedure assumes a Unix-based local machine using [curl](https://curl.haxx.se/) and [jq](https://stedolan.github.io/jq/).

From the bash command line, type the following commands, where `<email address>` is the Alert Logic Cloud Insight email address you use to log in. Enter your password when prompted.

```
export AL_USERNAME='<email address>'
auth=$(curl -X POST -s -u $AL_USERNAME https://api.global-services.global.alertlogic.com/aims/v1/authenticate); export AL_ERROR=$(echo $auth | jq -r '.error // ""'); export AL_ACCOUNT_ID=$(echo $auth | jq -r '.authentication.account.id'); export AL_USER_ID=$(echo $auth | jq -r '.authentication.user.id'); export AL_TOKEN=$(echo $auth | jq -r '.authentication.token'); if [ -n "$AL_ERROR" -o -z "$AL_TOKEN" ]; then echo "Authentication failure - $AL_ERROR "; else roles=$(curl -s -X GET -H "x-aims-auth-token: $AL_TOKEN" https://api.global-services.global.alertlogic.com/aims/v1/$AL_ACCOUNT_ID/users/$AL_USER_ID/roles | jq -r '.roles[].name'); if [ "$roles" != "Administrator" ]; then echo "The $AL_USERNAME doesn’t have Administrator role. Assigned role is '$roles'"; else curl -s -X POST -H "x-aims-auth-token: $AL_TOKEN" https://api.global-services.global.alertlogic.com/aims/v1/$AL_ACCOUNT_ID/users/$AL_USER_ID/access_keys | jq .; fi; fi; unset AL_USERNAME;
```

An example of a successful response is:

```
{
  "access_key_id": "712c0b413eef41f6",
  "secret_key": "1234567890b3eea8880d292fb31aa96902242a076d3d0e320cc036eb51bf25ad"
}
```

Make a note of the `access_key_id` and `secret_key` values, which you need to deploy the CloudFormation template to your AWS account. 

**Necessary role error**

If the command returns an error about not having the necessary role, please verify your Alert Logic account has administrator permissions. Click [here](https://console.cloudinsight.alertlogic.com/api/aims/) for more information about AIMS APIs.

**"Limit exceeded" error**

Each user can create only five access keys. If a "limit exceeded" response appears, you must delete one or more access keys before you can create new keys. 

1. Type the following command to list access keys:
    ```
    curl -s -X GET -H "x-aims-auth-token: $AL_TOKEN" https://api.global-services.global.alertlogic.com/aims/v1/$AL_ACCOUNT_ID/users/$AL_USER_ID/access_keys | jq
    ```
1. Use the selected access_key_id in the following command to delete the key:
    ```
    curl -X DELETE -H "x-aims-auth-token: $AL_TOKEN" https://api.global-services.global.alertlogic.com/aims/v1/$AL_ACCOUNT_ID/users/$AL_USER_ID/access_keys/<ACCESS_KEY_ID_HERE>
    ```


#### Windows

**Note:** These instructions require PowerShell 3.0 or later.

In the PowerShell console, please type the following commands. Enter your Alert Logic Cloud Insight email address and password when prompted.

```
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $creds = Get-Credential -Message "Please enter your Alert Logic Cloud Insight email address and password"; $unsecureCreds = $creds.GetNetworkCredential(); $base64AuthInfo = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(("{0}:{1}" -f $unsecureCreds.UserName,$unsecureCreds.Password))); Remove-Variable unsecureCreds; $AUTH = Invoke-RestMethod -Method Post -Headers @{"Authorization"=("Basic {0}" -f $base64AuthInfo)} -Uri https://api.global-services.global.alertlogic.com/aims/v1/authenticate ; Remove-Variable base64AuthInfo; $AL_ACCOUNT_ID = $AUTH.authentication.account.id; $AL_USER_ID = $AUTH.authentication.user.id; $AL_TOKEN = $AUTH.authentication.token; if (!$AL_TOKEN) { Write-Host "Authentication failure"} else { $ROLES_RESP = Invoke-RestMethod -Method Get -Headers @{"x-aims-auth-token"=$AL_TOKEN} -Uri https://api.global-services.global.alertlogic.com/aims/v1/$AL_ACCOUNT_ID/users/$AL_USER_ID/roles ; $ROLES = $ROLES_RESP.roles.name; if ($ROLES -ne "Administrator" ) { Write-Host "Your user doesn’t have Administrator role. Assigned role is '$ROLES'" } else { $ACCESS_KEY = Invoke-RestMethod -Method Post -Headers @{"x-aims-auth-token"=$AL_TOKEN} -Uri https://api.global-services.global.alertlogic.com/aims/v1/$AL_ACCOUNT_ID/users/$AL_USER_ID/access_keys ; Write-Host $ACCESS_KEY } }
```

An example of a successful response is:

```
@{access_key_id=712c0b413eef41f6; secret_key=1234567890b3eea8880d292fb31aa96902242a076d3d0e320cc036eb51bf25ad}
```

Make a note of the `access_key_id` and `secret_key` values, which you need to deploy the CloudFormation template to your AWS account.

**Necessary role error**

If the command returns an error about not having the necessary role, please verify your Alert Logic account has administrator permissions. Click [here](https://console.cloudinsight.alertlogic.com/api/aims/) for more information about AIMS APIs.

**"Limit exceeded" error**

Each user can create only five access keys. If a "limit exceeded" response appears, you must delete one or more access keys before you can create new keys.

1. Type the following command to list access keys:
    ```
    Invoke-RestMethod -Method Get -Headers @{"x-aims-auth-token"=$AL_TOKEN} -Uri https://api.global-services.global.alertlogic.com/aims/v1/$AL_ACCOUNT_ID/users/$AL_USER_ID/access_keys
    ```
1. Use the selected `access_key_id` in the following command to delete the key:
    ```
    Invoke-RestMethod -Method Delete -Headers @{"x-aims-auth-token"=$AL_TOKEN} -Uri https://api.global-services.global.alertlogic.com/aims/v1/$AL_ACCOUNT_ID/users/$AL_USER_ID/access_keys/<ACCESS_KEY_ID_HERE>
    ```

# Supported PAWS Logs Collectors

[OKTA Logs Collection](././collectors/okta/README-OKTA.md)

# Useful Links

- [Alert Logic AIMs service API](https://console.cloudinsight.alertlogic.com/api/aims/)
- [How to monitor AWS Lambda functions](http://docs.aws.amazon.com/lambda/latest/dg/monitoring-functions.html)

# Step to test in aws playground account(352283894008)
- In local add some mapping under SharedPrefix which you going to used while deploying the paws-shared-resources.template(https://algithub.pd.alertlogic.net/defender/paws-collectors-deploy-pipeline/blob/integration/cfn/paws-shared-resources.template#L37)

- Create the new stack with the paws-shared-resources.template which will created all the shared resources.

- Deploye the paws-collector-shared.template by providing all the existing value from paws-shared-resources.template *outputs* and fill remaining value as per collector requirement.

**Note:** paws-collector.template is not used in integration and production. It can also be used to deploy individual collector but might be missed some functionality.
