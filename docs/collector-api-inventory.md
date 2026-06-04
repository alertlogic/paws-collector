# PAWS Collector – Third-Party API Inventory

Canonical, source-of-truth inventory of every third-party API called by each PAWS
collector in this repository. Use this catalog instead of chasing per-collector
README links, which can become outdated or moved by the vendor.

---

## How to read this catalog

Each collector section follows the same structure:

- **Transport** – `REST` (direct HTTP) or `SDK` (vendor or third-party SDK).
- **Auth model** – how credentials are exchanged for an access token / signed request.
- **Base URL source** – where the host portion of the URL comes from (env var,
  vendor-fixed constant, dynamic discovery, SDK-managed, etc.).
- **API table** – grouped by purpose (`Authentication`, `Discovery`,
  `List/Get`, `Subscription`, `Check`).
- **Route pattern** – the full path **with placeholders in `{curly}` braces**.
  Hardcoded segments are written literally; everything dynamic is a placeholder.
- **Sample resolved URL** – an illustrative, sanitized example. Placeholders are
  filled with non-real, generic values (e.g. `ORG_PLACEHOLDER`, `TENANT_GUID`).
- **Vendor doc** – upstream documentation link. Some require a vendor login –
  marked as such.
- **Certainty** – `Confirmed` (visible in source code) or `SDK-managed`
  (the SDK constructs the URL internally; only method-level documentation is
  guaranteed).

### Placeholder conventions

| Placeholder | Meaning |
|---|---|
| `{baseUrl}` / `{apiHost}` | Host derived from `paws_endpoint` env var or vendor discovery |
| `{orgKey}` / `{tenantId}` | Customer-specific organization or tenant identifier |
| `{since}` / `{until}` | Collection time window (ISO8601 unless stated) |
| `{cursor}` / `{nextPage}` | Opaque pagination token returned by the vendor |
| `{stream}` | Configured collector stream / log type |



## Collector index

1. [Auth0](#auth0)
2. [Carbon Black](#carbon-black)
3. [Cisco AMP](#cisco-amp)
4. [Cisco Duo](#cisco-duo)
5. [Cisco Meraki](#cisco-meraki)
6. [Crowdstrike](#crowdstrike)
7. [Google Stackdriver (Cloud Logging)](#google-stackdriver-cloud-logging)
8. [G Suite (Google Workspace)](#g-suite-google-workspace)
9. [Mimecast](#mimecast)
10. [Office 365 (Microsoft 365)](#office-365-microsoft-365)
11. [Okta](#okta)
12. [Salesforce](#salesforce)
13. [SentinelOne](#sentinelone)
14. [Sophos Central](#sophos-central)
15. [Sophos SIEM](#sophos-siem)

---

## Auth0

- **Transport:** SDK (`auth0` npm package – `ManagementClient`)
- **Auth model:** OAuth2 client credentials grant handled inside the SDK
- **Base URL source:** `pawsDomainEndpoint` (Auth0 tenant domain, for example
  `your-tenant.auth0.com`)
- **Source:** [collectors/auth0/auth0_collector.js](../collectors/auth0/auth0_collector.js),
  [collectors/auth0/utils.js](../collectors/auth0/utils.js)

| Group | Transport | Method | Route Pattern | Sample Resolved URL | Certainty |
|---|---|---|---|---|---|
| Authentication | SDK | POST | `{baseUrl}/oauth/token` (issued by SDK during `ManagementClient` init) | `https://your-tenant.auth0.com/oauth/token` | SDK-managed |
| List logs | SDK | GET | `{baseUrl}/api/v2/logs?q={query}&per_page=100&sort=date:1` *(initial)* or `{baseUrl}/api/v2/logs?from={lastLogId}&take=100` *(pagination)* | `https://your-tenant.auth0.com/api/v2/logs?from=90020000000000000000000000_LAST_LOG_ID&take=100` | via SDK method `getLogs` |

**Vendor docs**
- [Auth0 Management API – Logs](https://auth0.com/docs/api/management/v2/logs/get-logs)
- [Auth0 rate limit policy](https://auth0.com/docs/troubleshoot/customer-support/operational-policies/rate-limit-policy/management-api-endpoint-rate-limits)

---

## Carbon Black

- **Transport:** REST (`@alertlogic/al-collector-js` RestServiceClient)
- **Auth model:** Static API key `X-Auth-Token: {clientSecret}/{clientId}`
- **Base URL source:** `paws_endpoint` env var (region-specific Carbon Black Cloud host,
  e.g. `https://api-prod06.conferdeploy.net`)
- **Source:** [collectors/carbonblack/collector.js](../collectors/carbonblack/collector.js),
  [collectors/carbonblack/utils.js](../collectors/carbonblack/utils.js)

| Group | Transport | Method | Route Pattern | Sample Resolved URL | Certainty |
|---|---|---|---|---|---|
| List audit log events | REST | GET | `{baseUrl}/integrationServices/v3/auditlogs` | `https://api-prod06.conferdeploy.net/integrationServices/v3/auditlogs` | Confirmed |
| Search alerts (all) | REST | POST | `{baseUrl}/api/alerts/v7/orgs/{orgKey}/alerts/_search` | `https://api-prod06.conferdeploy.net/api/alerts/v7/orgs/ORG_PLACEHOLDER/alerts/_search` | Confirmed |
| Search alerts (CB Analytics) | REST | POST | `{baseUrl}/api/alerts/v7/orgs/{orgKey}/alerts/_search` (criteria.type=`CB_ANALYTICS`) | same | Confirmed |
| Search alerts (Watchlist) | REST | POST | `{baseUrl}/api/alerts/v7/orgs/{orgKey}/alerts/_search` (criteria.type=`WATCHLIST`) | same | Confirmed |

Request body for the `_search` endpoints includes a `time_range` window built
from `{since}/{until}` and `rows`/`start` for paging.

**Vendor docs**
- [Carbon Black Cloud – Authentication](https://developer.carbonblack.com/reference/carbon-black-cloud/authentication/)
- [Audit Log Events API](https://developer.carbonblack.com/reference/carbon-black-cloud/platform/latest/audit-log-events-api/)
- [Alerts v7 Search API](https://developer.carbonblack.com/reference/carbon-black-cloud/platform/latest/alerts-api/)

---

## Cisco AMP

- **Transport:** REST (`@alertlogic/al-collector-js` RestServiceClient)
- **Auth model:** HTTP Basic – `Authorization: Basic {base64(clientId:clientSecret)}`
- **Base URL source:** `paws_endpoint` env var (regional AMP host, e.g.
  `https://api.amp.cisco.com`)
- **Source:** [collectors/ciscoamp/collector.js](../collectors/ciscoamp/collector.js),
  [collectors/ciscoamp/utils.js](../collectors/ciscoamp/utils.js)

| Group | Transport | Method | Route Pattern | Sample Resolved URL | Certainty |
|---|---|---|---|---|---|
| List audit logs | REST | GET | `{baseUrl}/v1/audit_logs?start_time={since}&end_time={until}` | `https://api.amp.cisco.com/v1/audit_logs?start_time=2026-06-01T00:00:00Z&end_time=2026-06-01T01:00:00Z` | Confirmed |
| List events | REST | GET | `{baseUrl}/v1/events?start_date={since}` | `https://api.amp.cisco.com/v1/events?start_date=2026-06-01T00:00:00Z` | Confirmed |
| Pagination | REST | GET | Follows `metadata.links.next` returned in response body (path only) | `{baseUrl}/v1/events?...&offset=500` | Confirmed |

**Vendor docs**
- [Cisco Secure Endpoint (AMP) API v1](https://developer.cisco.com/docs/secure-endpoint/overview/)
- [Audit Logs reference](https://developer.cisco.com/docs/secure-endpoint/auditlog/)
- [Events reference](https://developer.cisco.com/docs/secure-endpoint/v1-api-reference-event/)

---

## Cisco Duo

- **Transport:** SDK (`@duosecurity/duo_api` – `duo.Client.jsonApiCall`)
- **Auth model:** Duo Admin API HMAC-SHA1 request signing (handled by SDK)
- **Base URL source:** `pawsDomainEndpoint` (Duo Admin API hostname, e.g.
  `api-XXXXXXXX.duosecurity.com`)
- **Source:** [collectors/ciscoduo/collector.js](../collectors/ciscoduo/collector.js),
  [collectors/ciscoduo/utils.js](../collectors/ciscoduo/utils.js)

| Group | Stream | Method | Route Pattern | Sample Resolved URL | Certainty |
|---|---|---|---|---|---|
| List authentication logs | `Authentication` | GET | `{baseUrl}/admin/v2/logs/authentication?mintime={since}&maxtime={until}&limit=1000` | `https://api-XXXXXXXX.duosecurity.com/admin/v2/logs/authentication?mintime=1717200000000&maxtime=1717203600000&limit=1000` | Confirmed |
| List admin logs | `Administrator` | GET | `{baseUrl}/admin/v1/logs/administrator?mintime={since}` | `https://api-XXXXXXXX.duosecurity.com/admin/v1/logs/administrator?mintime=1717200000` | Confirmed |
| List telephony logs | `Telephony` | GET | `{baseUrl}/admin/v1/logs/telephony?mintime={since}` | `https://api-XXXXXXXX.duosecurity.com/admin/v1/logs/telephony?mintime=1717200000` | Confirmed |
| List offline-enrollment logs | `OfflineEnrollment` | GET | `{baseUrl}/admin/v1/logs/offline_enrollment?mintime={since}` | `https://api-XXXXXXXX.duosecurity.com/admin/v1/logs/offline_enrollment?mintime=1717200000` | Confirmed |

**Vendor docs**
- [Duo Admin API overview](https://duo.com/docs/adminapi)
- [Authentication logs (v2)](https://duo.com/docs/adminapi#authentication-logs)
- [Administrator / Telephony / Offline-enrollment logs](https://duo.com/docs/adminapi#logs)

---

## Cisco Meraki

- **Transport:** REST (`axios`) via in-repo wrapper
- **Auth model:** Bearer API key – `Authorization: Bearer {apiKey}`
- **Base URL source:** `paws_endpoint` env var, default `https://api.meraki.com`
- **Source:** [collectors/ciscomeraki/collector.js](../collectors/ciscomeraki/collector.js),
  [collectors/ciscomeraki/meraki_client.js](../collectors/ciscomeraki/meraki_client.js)

| Group | Method | Route Pattern | Sample Resolved URL | Certainty |
|---|---|---|---|---|
| List networks for org | GET | `{baseUrl}/api/v1/organizations/{orgKey}/networks?perPage=1000` | `https://api.meraki.com/api/v1/organizations/ORG_PLACEHOLDER/networks?perPage=1000` | Confirmed |
| List network events | GET | `{baseUrl}/api/v1/networks/{networkId}/events?perPage=500&productType={productType}&startingAfter={cursor}` | `https://api.meraki.com/api/v1/networks/NETWORK_PLACEHOLDER/events?perPage=500&productType=appliance&startingAfter=2026-06-01T00:00:00Z` | Confirmed |
| Pagination | GET | Follows `Link: <...>; rel=next` header from the previous response | (driven by header) | Confirmed |

**Vendor docs**
- [Meraki Dashboard API – Getting started](https://developer.cisco.com/meraki/api-v1/)
- [Network events endpoint](https://developer.cisco.com/meraki/api-v1/get-network-events/)
- [List organization networks](https://developer.cisco.com/meraki/api-v1/get-organization-networks/)

---

## Crowdstrike

- **Transport:** REST (`@alertlogic/al-collector-js` RestServiceClient)
- **Auth model:** OAuth2 client credentials – then `Authorization: Bearer {token}`
- **Base URL source:** `pawsDomainEndpoint` (regional Falcon API host, e.g.
  `api.crowdstrike.com`, `api.us-2.crowdstrike.com`, `api.eu-1.crowdstrike.com`)
- **Source:** [collectors/crowdstrike/collector.js](../collectors/crowdstrike/collector.js),
  [collectors/crowdstrike/utils.js](../collectors/crowdstrike/utils.js)

| Group | Method | Route Pattern | Sample Resolved URL | Certainty |
|---|---|---|---|---|
| Authentication (OAuth2 token) | POST | `{baseUrl}/oauth2/token` (form body: `client_id`, `client_secret`) | `https://api.crowdstrike.com/oauth2/token` | Confirmed |
| Query alerts (IDs) | GET | `{baseUrl}/alerts/queries/alerts/v2?limit=100&offset={offset}&filter={urlencoded_filter}` | `https://api.crowdstrike.com/alerts/queries/alerts/v2?limit=100&offset=0&filter=product%3A%5B%27epp%27%5D%2Bcreated_timestamp%3A%3E%222026-06-01T00%3A00%3A00Z%22` | Confirmed |
| Get alert details | POST | `{baseUrl}/alerts/entities/alerts/v2` (JSON body `{ composite_ids: [...] }`) | `https://api.crowdstrike.com/alerts/entities/alerts/v2` | Confirmed |

The alert filter is built from `product:[...]` plus a `created_timestamp` window
derived from `{since}/{until}`.

**Vendor docs**
- [Falcon OAuth2 Auth API](https://falcon.crowdstrike.com/documentation/page/oauth2-apis)
- [Alerts API (v2)](https://falcon.crowdstrike.com/documentation/page/alerts-api)

---

## Google Stackdriver (Cloud Logging)

- **Transport:** SDK (`googleapis` – `google.logging({version: 'v2'})`)
- **Auth model:** Google service account JSON key (delegated subject optional)
- **Base URL source:** SDK-managed (`https://logging.googleapis.com`)
- **Source:** [collectors/googlestackdriver/collector.js](../collectors/googlestackdriver/collector.js)

| Group | Transport | Method | Route Pattern | Sample Resolved URL | Certainty |
|---|---|---|---|---|---|
| Authentication | SDK | POST | `https://oauth2.googleapis.com/token` (service-account assertion) | `https://oauth2.googleapis.com/token` | SDK-managed |
| List log entries | SDK | POST | `https://logging.googleapis.com/v2/entries:list` (body: `resourceNames`, `filter`, `pageSize`, `pageToken`) | `https://logging.googleapis.com/v2/entries:list` | Confirmed (method `logging.entries.list`) |

OAuth scopes requested:
`cloud-platform`, `cloud-platform.read-only`, `logging.admin`, `logging.read`,
`logging.write`.

**Vendor docs**
- [Cloud Logging API v2 – entries.list](https://cloud.google.com/logging/docs/reference/v2/rest/v2/entries/list)
- [Cloud Logging quotas & limits](https://cloud.google.com/logging/quotas)

---

## G Suite (Google Workspace)

- **Transport:** SDK (`googleapis` – `google.admin('reports_v1')`, `google.alertcenter('v1beta1')`)
- **Auth model:** Google service account JSON key with domain-wide delegation
- **Base URL source:** SDK-managed
- **Source:** [collectors/gsuite/collector.js](../collectors/gsuite/collector.js),
  [collectors/gsuite/utils.js](../collectors/gsuite/utils.js)

| Group | Transport | Method | Route Pattern | Sample Resolved URL | Certainty |
|---|---|---|---|---|---|
| Authentication | SDK | POST | `https://oauth2.googleapis.com/token` | `https://oauth2.googleapis.com/token` | SDK-managed |
| List activities for app | SDK | GET | `https://admin.googleapis.com/admin/reports/v1/activity/users/all/applications/{applicationName}?startTime={since}&endTime={until}&pageToken={cursor}` | `https://admin.googleapis.com/admin/reports/v1/activity/users/all/applications/login?startTime=2026-06-01T00:00:00Z&endTime=2026-06-01T01:00:00Z` | Confirmed (method `activities.list`) |
| List alert center alerts | SDK | GET | `https://alertcenter.googleapis.com/v1beta1/alerts?filter=startTime>="{since}" AND startTime<"{until}"&pageToken={cursor}` | `https://alertcenter.googleapis.com/v1beta1/alerts?filter=startTime%3E%3D%222026-06-01T00%3A00%3A00Z%22` | Confirmed (method `alerts.list`) |

**Vendor docs**
- [Admin SDK – Reports activities.list](https://developers.google.com/admin-sdk/reports/v1/reference/activities/list)
- [Alert Center API – alerts.list](https://developers.google.com/admin-sdk/alertcenter/reference/rest/v1beta1/alerts/list)

---

## Mimecast

- **Transport:** REST (`axios`)
- **Auth model:** Mimecast HMAC-SHA1 signing of `date:reqId:uri:appKey` with
  `Authorization: MC {accessKey}:{signature}`, plus `x-mc-app-id`,
  `x-mc-date`, `x-mc-req-id`
- **Base URL source:** `pawsDomainEndpoint` (regional Mimecast host,
  e.g. `eu-api.mimecast.com`)
- **Source:** [collectors/mimecast/collector.js](../collectors/mimecast/collector.js),
  [collectors/mimecast/utils.js](../collectors/mimecast/utils.js)

| Group | Stream | Method | Route Pattern | Sample Resolved URL | Certainty |
|---|---|---|---|---|---|
| SIEM logs | `SiemLogs` | POST | `https://{baseUrl}/api/audit/get-siem-logs` (body sets `type=MTA`, `compress=true`, optional `token`) | `https://eu-api.mimecast.com/api/audit/get-siem-logs` | Confirmed |
| Attachment Protect logs | `AttachmentProtectLogs` | POST | `https://{baseUrl}/api/ttp/attachment/get-logs` (paginated via `meta.pagination`) | `https://eu-api.mimecast.com/api/ttp/attachment/get-logs` | Confirmed |
| URL Protect logs | `URLProtectLogs` | POST | `https://{baseUrl}/api/ttp/url/get-logs` (paginated via `meta.pagination`) | `https://eu-api.mimecast.com/api/ttp/url/get-logs` | Confirmed |
| Threat feed | `MalwareFeed` | POST | `https://{baseUrl}/api/ttp/threat-intel/get-feed` (body `fileType=stix`, optional `token`) | `https://eu-api.mimecast.com/api/ttp/threat-intel/get-feed` | Confirmed |

Continuation tokens come from response headers (`mc-siem-token`,
`x-mc-threat-feed-next-token`) or response body
(`body.meta.pagination.next`).

**Vendor docs**
- [Mimecast – API auth & signing](https://integrations.mimecast.com/documentation/api-overview/authentication-and-authorization/)
- [Get SIEM Logs](https://integrations.mimecast.com/documentation/endpoint-reference/logs-and-statistics/get-siem-logs/)
- [Get TTP Attachment Logs](https://integrations.mimecast.com/documentation/endpoint-reference/logs-and-statistics/get-ttp-attachment-protection-logs/)
- [Get TTP URL Logs](https://integrations.mimecast.com/documentation/endpoint-reference/logs-and-statistics/get-ttp-url-logs/)
- [Get Threat Intel Feed](https://integrations.mimecast.com/documentation/endpoint-reference/threat-intel/get-feed/)

---

## Office 365 (Microsoft 365)

- **Transport:** REST through in-repo `o365_mgmnt` wrapper built on
  `@azure/ms-rest-azure-js` (Azure AD client credentials handled by SDK)
- **Auth model:** Azure AD OAuth2 client credentials – `Authorization: Bearer {token}`
- **Base URL source:** Hardcoded to `https://manage.office.com`
- **Source:** [collectors/o365/o365_collector.js](../collectors/o365/o365_collector.js),
  [collectors/o365/lib/o365_mgmnt/o365management.js](../collectors/o365/lib/o365_mgmnt/o365management.js)

| Group | Method | Route Pattern | Sample Resolved URL | Certainty |
|---|---|---|---|---|
| Authentication | POST | `https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token` | `https://login.microsoftonline.com/TENANT_GUID/oauth2/v2.0/token` | SDK-managed |
| List subscriptions | GET | `https://manage.office.com/api/v1.0/{tenantId}/activity/feed/subscriptions/list?PublisherIdentifier={publisherId}` | `https://manage.office.com/api/v1.0/TENANT_GUID/activity/feed/subscriptions/list?PublisherIdentifier=TENANT_GUID` | Confirmed |
| Start subscription | POST | `https://manage.office.com/api/v1.0/{tenantId}/activity/feed/subscriptions/start?contentType={stream}&PublisherIdentifier={publisherId}` | `https://manage.office.com/api/v1.0/TENANT_GUID/activity/feed/subscriptions/start?contentType=Audit.AzureActiveDirectory&PublisherIdentifier=TENANT_GUID` | Confirmed |
| List content blobs | GET | `https://manage.office.com/api/v1.0/{tenantId}/activity/feed/subscriptions/content?contentType={stream}&startTime={since}&endTime={until}&PublisherIdentifier={publisherId}` | `https://manage.office.com/api/v1.0/TENANT_GUID/activity/feed/subscriptions/content?contentType=Audit.Exchange&startTime=2026-06-01T00:00:00Z&endTime=2026-06-01T01:00:00Z&PublisherIdentifier=TENANT_GUID` | Confirmed |
| Fetch content blob / next page | GET | Follow vendor-issued `contentUri` / `NextPageUri` from previous response (host is `manage.office.com`) | `https://manage.office.com/api/v1.0/TENANT_GUID/activity/feed/audit/...` | Confirmed |

`{stream}` is one of the configured `collector_streams`, e.g.
`Audit.AzureActiveDirectory`, `Audit.Exchange`, `Audit.SharePoint`,
`Audit.General`, `DLP.All`.

**Vendor docs**
- [Office 365 Management Activity API – overview](https://learn.microsoft.com/en-us/office/office-365-management-api/office-365-management-activity-api-reference)
- [Subscriptions: list / start / stop](https://learn.microsoft.com/en-us/office/office-365-management-api/office-365-management-activity-api-reference#working-with-the-office-365-management-activity-api)
- [Microsoft identity platform – client credentials](https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-client-creds-grant-flow)

---

## Okta

- **Transport:** SDK (`@okta/okta-sdk-nodejs` – `okta.Client.systemLogApi.listLogEvents`)
- **Auth model:** Okta API token (`Authorization: SSWS {apiToken}`)
- **Base URL source:** `pawsHttpsEndpoint` (Okta org URL,
  e.g. `https://your-org.okta.com`)
- **Source:** [collectors/okta/okta_collector.js](../collectors/okta/okta_collector.js)

| Group | Transport | Method | Route Pattern | Sample Resolved URL | Certainty |
|---|---|---|---|---|---|
| List system log events | SDK | GET | `{baseUrl}/api/v1/logs?since={since}&until={until}` (pagination via `Link: rel=next`) | `https://your-org.okta.com/api/v1/logs?since=2026-06-01T00:00:00.000Z&until=2026-06-01T01:00:00.000Z` | Confirmed (method `systemLogApi.listLogEvents`) |

**Vendor docs**
- [Okta System Log API](https://developer.okta.com/docs/reference/api/system-log/)
- [Okta API rate limits](https://developer.okta.com/docs/reference/rate-limits/)

---

## Salesforce

- **Transport:** REST for OAuth (`@alertlogic/al-collector-js` RestServiceClient)
  + SDK (`jsforce`) for SOQL queries
- **Auth model:** OAuth2 JWT bearer flow (`urn:ietf:params:oauth:grant-type:jwt-bearer`),
  JWT signed locally with the customer's RSA private key (RS256)
- **Base URL source:** `paws_endpoint` env var
  (`https://login.salesforce.com` or `https://test.salesforce.com`); per-org
  data host is returned in the OAuth response as `instance_url`
- **Source:** [collectors/salesforce/collector.js](../collectors/salesforce/collector.js),
  [collectors/salesforce/utils.js](../collectors/salesforce/utils.js)

| Group | Transport | Method | Route Pattern | Sample Resolved URL | Certainty |
|---|---|---|---|---|---|
| Authentication (JWT bearer) | REST | POST | `{baseUrl}/services/oauth2/token` (form: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer`, `assertion={jwt}`) | `https://login.salesforce.com/services/oauth2/token` | Confirmed |
| Query objects (SOQL) | SDK | GET | `{instance_url}/services/data/v48.0/query?q={soql}` | `https://yourorg.my.salesforce.com/services/data/v48.0/query?q=SELECT+Id...` | SDK-managed (via `jsforce.Connection.query`) |

SOQL templates per stream (built in [collectors/salesforce/utils.js](../collectors/salesforce/utils.js)):

| Stream | Object queried |
|---|---|
| `LoginHistory` | `LoginHistory` (joined with `LoginGeo`) |
| `EventLogFile` | `EventLogFile` (filter `EventType in (Login, API, Logout)`) |
| `ApiEvent` | `ApiEvent` |
| `LoginEvent` | `LoginEvent` |
| `LogoutEvent` | `LogoutEvent` |
| `LoginAsEvent` | `LoginAsEvent` |

**Vendor docs**
- [Salesforce OAuth 2.0 JWT bearer flow](https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_jwt_flow.htm)
- [REST API query endpoint](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_query.htm)
- [jsforce – connection](https://jsforce.github.io/document/#connection)

---

## SentinelOne

- **Transport:** REST (`@alertlogic/al-collector-js` RestServiceClient)
- **Auth model:** Static API token – `Authorization: ApiToken {token}`
- **Base URL source:** `paws_endpoint` env var (per-tenant Management host,
  e.g. `https://usea1-yourtenant.sentinelone.net`)
- **Source:** [collectors/sentinelone/collector.js](../collectors/sentinelone/collector.js),
  [collectors/sentinelone/utils.js](../collectors/sentinelone/utils.js)

| Group | Method | Route Pattern | Sample Resolved URL | Certainty |
|---|---|---|---|---|
| List activities | GET | `{baseUrl}/web/api/v2.1/activities?createdAt__gte={since}&createdAt__lt={until}&limit=100&cursor={cursor}` | `https://usea1-yourtenant.sentinelone.net/web/api/v2.1/activities?createdAt__gte=2026-06-01T00:00:00.000Z&createdAt__lt=2026-06-01T01:00:00.000Z&limit=100` | Confirmed |

**Vendor docs**
- [SentinelOne Management API – Activities](https://usea1-partners.sentinelone.net/api-doc/api-details?category=activities&api=get-activities)
  *(requires vendor login)*

---

## Sophos Central

- **Transport:** REST (`@alertlogic/al-collector-js` RestServiceClient)
- **Auth model:** OAuth2 client credentials (scope `token`), then per-tenant call
  with `X-Tenant-ID: {tenantId}` and `Authorization: Bearer {token}`
- **Base URL source:** Two vendor-fixed hosts plus a dynamic data-region host
  discovered at runtime:
  - Auth: `id.sophos.com`
  - Tenant lookup: `api.central.sophos.com`
  - Data calls: `apiHosts.dataRegion` returned from `/whoami/v1`
- **Source:** [collectors/sophos/collector.js](../collectors/sophos/collector.js),
  [collectors/sophos/utils.js](../collectors/sophos/utils.js)

| Group | Method | Route Pattern | Sample Resolved URL | Certainty |
|---|---|---|---|---|
| Authentication | POST | `https://id.sophos.com/api/v2/oauth2/token` (form: `grant_type=client_credentials`, `scope=token`) | `https://id.sophos.com/api/v2/oauth2/token` | Confirmed |
| Tenant / data region discovery | GET | `https://api.central.sophos.com/whoami/v1` | `https://api.central.sophos.com/whoami/v1` | Confirmed |
| List alerts | GET | `https://{dataRegionHost}/common/v1/alerts?from={since}&to={until}&pageFromKey={cursor}` | `https://api-eu01.central.sophos.com/common/v1/alerts?from=2026-06-01T00:00:00Z&to=2026-06-01T01:00:00Z` | Confirmed |

**Vendor docs**
- [Sophos Central API – Getting started](https://developer.sophos.com/getting-started)
- [Common v1 – Alerts](https://developer.sophos.com/docs/common-v1/1/routes/alerts/get)
- [whoami endpoint](https://developer.sophos.com/getting-started)

---

## Sophos SIEM

- **Transport:** REST (`@alertlogic/al-collector-js` RestServiceClient)
- **Auth model:** Two modes:
  - *Legacy* – OAuth2 client credentials against `id.sophos.com`, then per-tenant
    `X-Tenant-ID` + `Authorization: Bearer {token}` (same as Sophos Central).
  - *Gateway* – API key style: `x-api-key: {clientId}`, `Authorization: {secret}`
    when the configured endpoint contains `/gateway`.
- **Base URL source:** `pawsDomainEndpoint`; for the legacy mode the data host
  is the `apiHosts.dataRegion` returned by `/whoami/v1`.
- **Source:** [collectors/sophossiem/collector.js](../collectors/sophossiem/collector.js),
  [collectors/sophossiem/utils.js](../collectors/sophossiem/utils.js)

| Group | Stream | Method | Route Pattern | Sample Resolved URL | Certainty |
|---|---|---|---|---|---|
| Authentication (legacy) | – | POST | `https://id.sophos.com/api/v2/oauth2/token` | `https://id.sophos.com/api/v2/oauth2/token` | Confirmed |
| Tenant lookup (legacy) | – | GET | `https://api.central.sophos.com/whoami/v1` | `https://api.central.sophos.com/whoami/v1` | Confirmed |
| List SIEM events | `Events` | GET | `https://{apiHost}/siem/v1/events?from_date={fromDate}&limit=1000&cursor={cursor}` | `https://api-eu01.central.sophos.com/siem/v1/events?from_date=1717200000&limit=1000` | Confirmed |
| List SIEM alerts | `Alerts` | GET | `https://{apiHost}/siem/v1/alerts?from_date={fromDate}&limit=1000&cursor={cursor}` | `https://api-eu01.central.sophos.com/siem/v1/alerts?from_date=1717200000&limit=1000` | Confirmed |

**Vendor docs**
- [Sophos SIEM Integration – Events API](https://developer.sophos.com/docs/siem-v1/1/routes/events/get)
- [Sophos SIEM Integration – Alerts API](https://developer.sophos.com/docs/siem-v1/1/routes/alerts/get)
