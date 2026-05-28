# PAWS Collector — Architecture Document

> This document describes the complete lifecycle of a PAWS Collector — from creation through runtime operation to deletion.
> All diagrams are rendered using Mermaid. View in VS Code with the **Markdown Preview Mermaid Support** extension, or on GitHub natively.

---

## Table of Contents

1. [Registration Flow](#1-registration-flow)
2. [Poll Event Flow](#2-poll-event-flow)
3. [Checkin Event](#3-checkin-event-every-15-minutes)
4. [Self-Update Event](#4-self-update-event-every-12-hours)
5. [Deregistration Flow](#5-deregistration-flow)
6. [Full Architecture Overview — Part A: Collector Creation](#6-full-architecture-overview--part-a-collector-creation)
7. [Full Architecture Overview — Part B: Runtime Events & Deregistration](#7-full-architecture-overview--part-b-runtime-events--deregistration)

---

## 1. Registration Flow

**Key points:**
- **Themis Service** is validation-only — it validates credentials and returns Pass or Fail to Application Service. It has no further involvement.
- **Application Service** decides the next step based on Themis result.
- **Azcollect** deploys the CFN Stack which creates all AWS resources.
- **Lambda** handles the CFN `onCreate` event — registers the asset, gets Collector ID, and seeds SQS with state messages (one per stream).

```mermaid
sequenceDiagram
    actor User
    participant UI as Application Registry UI
    participant AppSvc as Application Service
    participant Themis as Themis Service
    participant Azcollect as Azcollect Service
    participant CFN as CloudFormation Stack
    participant Lambda as Collector Lambda
    participant Asset as Asset Service
    participant SQS as SQS Queue

    User->>UI: Create Collector
    UI->>AppSvc: Submit Request
    AppSvc->>Themis: Validate Credentials
    Themis-->>AppSvc: Pass or Fail

    alt Validation Failed
        AppSvc->>UI: Show Validation Error
        UI-->>User: Display Error
    else Validation Passed
        AppSvc->>Azcollect: API Call - Register Collector
        Azcollect->>CFN: Deploy CFN Stack in AWS Account
        Note over CFN: Creates all resources:<br/>SQS Queue<br/>Collector Lambda + Env Variables<br/>System Manager - Credential Store<br/>Checkin Scheduler - every 15 min<br/>Self-Update Scheduler - every 12 hrs
        CFN->>Lambda: Trigger Register Event (onCreate)
        Lambda->>Azcollect: API Call - Register Asset
        Azcollect->>Asset: Create Asset Entry
        Asset-->>Azcollect: Return Collector ID
        Azcollect-->>Lambda: Return Collector ID
        Lambda->>SQS: Add State Message per Stream
        Lambda-->>CFN: Registration Successful
        alt Registration Failed
            CFN->>CFN: Rollback and Delete All Resources
            CFN->>Asset: Delete Asset Entry
            Azcollect-->>AppSvc: Registration Failed
            AppSvc->>UI: Remove Entry
            UI-->>User: Show Failure
        else Registration Succeeded
            CFN-->>Azcollect: Stack Created Successfully
            Azcollect-->>AppSvc: Collector Registered
            AppSvc->>UI: Update Registry
            UI-->>User: Collector Active
        end
    end
```

---

## 2. Poll Event Flow

**Key points:**
- SQS triggers Lambda when a state message becomes available (based on poll interval delay).
- Lambda reads the state, polls the 3rd party API for logs, sends them to Ingest, then pushes the next state message back to SQS with the next interval delay.
- This cycle repeats continuously per stream.

```mermaid
sequenceDiagram
    participant SQS as SQS Queue
    participant Lambda as Collector Lambda
    participant ThirdParty as 3rd Party API
    participant Ingest as Ingest Service

    loop Each Poll Cycle - per stream state message
        SQS->>Lambda: Trigger - Deliver State Message
        Note over Lambda: Reads state, determines time range to collect
        Lambda->>ThirdParty: API Call - Poll Log Data
        ThirdParty-->>Lambda: Return Log Data
        Lambda->>Ingest: Send Logs to Ingest Service
        Ingest-->>Lambda: Acknowledgment
        Lambda->>SQS: Push Next State Message with poll interval delay
        Note over SQS: Holds message until next poll interval fires
    end
```

---

## 3. Checkin Event (every 15 minutes)

**Key points:**
- Checkin Scheduler is created by CFN at stack creation time.
- It fires every 15 minutes and directly triggers the Collector Lambda.
- Lambda collects CloudWatch metrics (invocations and errors) and CFN stack health, then reports status to the Collector Status Service.

```mermaid
sequenceDiagram
    participant SchedCI as Checkin Scheduler
    participant Lambda as Collector Lambda
    participant CW as CloudWatch Metrics
    participant CFN as CloudFormation Stack
    participant Status as Collector Status Service

    loop Every 15 Minutes
        SchedCI->>Lambda: Trigger Checkin Event
        Lambda->>CW: Fetch Invocation and Error Metrics
        CW-->>Lambda: Metrics Data
        Lambda->>CFN: Check CFN Stack Health
        CFN-->>Lambda: Stack Health Status
        Lambda->>Status: Send Collector Status - healthy or unhealthy
        Status-->>Lambda: Acknowledgment
    end
```

---

## 4. Self-Update Event (every 12 hours)

**Key points:**
- Self-Update Scheduler is created by CFN at stack creation time.
- It fires every 12 hours and triggers the Collector Lambda.
- Lambda checks S3 for a new code zip — if a new version exists it downloads and updates all collectors. Otherwise it skips.

```mermaid
sequenceDiagram
    participant SchedSU as Self-Update Scheduler
    participant Lambda as Collector Lambda
    participant S3 as S3 - Lambda Code Zip

    loop Every 12 Hours
        SchedSU->>Lambda: Trigger Self-Update Event
        Lambda->>S3: Check for Updated Code Zip
        alt New Version Found
            S3-->>Lambda: Download New Zip
            Lambda->>Lambda: Update All Collectors with New Code
        else No Update
            S3-->>Lambda: No Changes - Skip
        end
    end
```

---

## 5. Deregistration Flow

**Key points:**
- Application Service calls Azcollect to initiate deletion.
- Azcollect triggers CFN stack deletion.
- CFN fires the `onDelete` event which is handled by Lambda.
- Lambda calls Azcollect to deregister the asset — Azcollect deletes the entry from Asset Service and notifies Application Service so the UI is updated.
- CFN then deletes all stack resources independently.

```mermaid
sequenceDiagram
    actor User
    participant UI as Application Registry UI
    participant AppSvc as Application Service
    participant Azcollect as Azcollect Service
    participant CFN as CloudFormation Stack
    participant Lambda as Collector Lambda
    participant Asset as Asset Service
    participant AWS as AWS Resources

    User->>UI: Delete Collector
    UI->>AppSvc: Deregister Request
    AppSvc->>Azcollect: API Call - Deregister Collector
    Azcollect->>CFN: Trigger Delete CFN Stack
    CFN->>Lambda: Trigger Deregister Event (onDelete)
    Lambda->>Azcollect: API Call - Deregister Asset
    Azcollect->>Asset: Delete Asset Entry
    Asset-->>Azcollect: Entry Deleted
    Azcollect->>AppSvc: Send Deregister Response
    AppSvc->>UI: Remove Collector from Registry
    UI-->>User: Collector Deleted Successfully
    Lambda-->>CFN: Deregister Complete
    CFN->>AWS: Delete All Stack Resources
    Note over AWS: Removes:<br/>SQS Queue<br/>Collector Lambda<br/>System Manager Credentials<br/>Checkin Scheduler<br/>Self-Update Scheduler
    AWS-->>CFN: All Resources Deleted
    alt Stack Deletion Failed
        CFN-->>Azcollect: Stack Rollback or Failure
        Azcollect-->>AppSvc: Deletion Failed
        AppSvc->>UI: Show Error
        UI-->>User: Deletion Failed
    end
```

---

## 6. Full Architecture Overview — Part A: Collector Creation

> Shows the complete Registration path: UI → Themis validation → Azcollect → CFN stack deployment → all AWS resources created → Lambda `onCreate` event → Asset registration → SQS seeding.

**All Lambda event triggers at a glance:**

| Event | Trigger | Handled By |
|---|---|---|
| Register | CFN onCreate | Lambda |
| Poll | SQS state message | Lambda |
| Checkin | Scheduler (15 min) | Lambda |
| Self-Update | Scheduler (12 hrs) | Lambda |
| Deregister | CFN onDelete | Lambda |

```mermaid
flowchart TD
    User([User]) -->|Create Collector| UI[Application Registry UI]
    UI -->|Submit Request| AppSvc[Application Service]
    AppSvc -->|Validate Credentials| Themis["🔒 Themis Service\nValidation Only"]
    Themis -->|Pass or Fail| AppSvc
    AppSvc -->|Fail: Show Error| UI

    AppSvc -->|Pass: API Call| Azcollect["⚙️ Azcollect Service"]
    Azcollect -->|Deploy CFN Stack| CFN["☁️ CloudFormation Stack"]

    CFN -->|Creates| SQS["📬 SQS Queue"]
    CFN -->|Creates| Lambda["λ Collector Lambda\nAll config in Env Variables"]
    CFN -->|Stores Credentials| SM["🔑 System Manager\nCredential Store"]
    CFN -->|Creates| SchedCI["⏱ Checkin Scheduler\nevery 15 min"]
    CFN -->|Creates| SchedSU["⏱ Self-Update Scheduler\nevery 12 hrs"]

    CFN -->|"onCreate Event"| Lambda
    Lambda -->|Register API Call| Azcollect
    Azcollect -->|Create Entry| Asset["🗂 Asset Service"]
    Asset -->|Collector ID| Azcollect
    Azcollect -->|Return Collector ID| Lambda
    Lambda -->|Add State Messages per stream| SQS
    Lambda -->|Registration Success| CFN
    CFN -->|Stack Created| Azcollect
    Azcollect -->|Success Response| AppSvc
    AppSvc -->|Update Registry| UI

    style Themis fill:#fff4e1,stroke:#e6a817,color:#333
    style CFN fill:#f0e1ff,stroke:#9b59b6,color:#333
    style Asset fill:#e1ffe1,stroke:#27ae60,color:#333
    style Azcollect fill:#e1f0ff,stroke:#2980b9,color:#333
    style Lambda fill:#ffe1e1,stroke:#e74c3c,color:#333
    style SchedCI fill:#e8f5e9,stroke:#27ae60,color:#333
    style SchedSU fill:#e8f5e9,stroke:#27ae60,color:#333
    style SQS fill:#fef9e7,stroke:#f39c12,color:#333
    style SM fill:#fadbd8,stroke:#e74c3c,color:#333
```

---

## 7. Full Architecture Overview — Part B: Runtime Events & Deregistration

> Shows all 4 recurring Lambda events (Poll, Checkin, Self-Update) and the complete Deregistration path.

```mermaid
flowchart TD
    subgraph POLL["🔄  POLL EVENT — triggered by SQS"]
        direction LR
        SQS2["📬 SQS Queue"] -->|"Trigger: state message"| Lambda2["λ Collector Lambda"]
        Lambda2 -->|Poll Log Data| API["🌐 3rd Party API"]
        API -->|Return Logs| Lambda2
        Lambda2 -->|Send Logs| Ingest["📥 Ingest Service"]
        Lambda2 -->|Push next state message| SQS2
    end

    subgraph CHECKIN["🩺  CHECKIN EVENT — every 15 min"]
        direction LR
        SchedCI2["⏱ Checkin Scheduler"] -->|Trigger| Lambda3["λ Collector Lambda"]
        Lambda3 -->|Fetch Invocations and Errors| CW["📊 CloudWatch Metrics"]
        CW -->|Metrics Data| Lambda3
        Lambda3 -->|Check Stack Health| CFN2["☁️ CloudFormation"]
        CFN2 -->|Health Status| Lambda3
        Lambda3 -->|Send Status| StatusSvc["📡 Collector Status Service"]
    end

    subgraph UPDATE["🔁  SELF-UPDATE EVENT — every 12 hrs"]
        direction LR
        SchedSU2["⏱ Self-Update Scheduler"] -->|Trigger| Lambda4["λ Collector Lambda"]
        Lambda4 -->|Check for new zip| S3["🪣 S3 Lambda Code"]
        S3 -->|New version found| Lambda4
        Lambda4 -->|Update all collectors| Lambda4
    end

    subgraph DEREG["🗑️  DEREGISTRATION"]
        direction LR
        User2([User]) -->|Delete Collector| UI2["Application Registry UI"]
        UI2 --> AppSvc2["Application Service"]
        AppSvc2 -->|Deregister API Call| Azcollect2["⚙️ Azcollect Service"]
        Azcollect2 -->|Trigger Delete Stack| CFN3["☁️ CloudFormation Stack"]
        CFN3 -->|"onDelete Event"| Lambda5["λ Collector Lambda"]
        Lambda5 -->|Deregister API Call| Azcollect2
        Azcollect2 -->|Delete Asset Entry| Asset2["🗂 Asset Service"]
        Azcollect2 -->|Notify Success| AppSvc2
        AppSvc2 -->|Remove from Registry| UI2
        Lambda5 -->|Deregister Complete| CFN3
        CFN3 -->|Delete All Resources| AWS["☁️ AWS Resources\nSQS · Lambda · SM · Schedulers"]
    end

    style POLL fill:#f9fff9,stroke:#27ae60
    style CHECKIN fill:#fffff0,stroke:#f39c12
    style UPDATE fill:#fff5f5,stroke:#e74c3c
    style DEREG fill:#f5f0ff,stroke:#9b59b6
```

---

*Last updated: May 2026*
