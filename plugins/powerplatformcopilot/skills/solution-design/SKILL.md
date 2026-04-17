# Skill: Solution Design

> **Purpose:** Defines the architectural thinking process, design patterns, and decision-making frameworks applied when producing high-level solution designs for Dynamics 365 and Power Platform engagements.

---

## When This Skill Is Applied

This skill is invoked by:
- **Solutions Architect Agent** — primary consumer
- **D365 Copilot Service Specialist** — for D365-specific design decisions
- **Power Platform Specialist** — for PP-specific design decisions

---

## Architectural Thinking Process

### Step 1 — Understand Before Designing

Before producing any design output, internalize:

1. **The business goal** — What problem is the customer solving? What does success look like?  
2. **The personas** — Who uses this system? What are their pain points and daily tasks?  
3. **The data** — What are the key entities? Where does data originate? Where does it flow?  
4. **The constraints** — What are the non-negotiables? (Tech, budget, timeline, compliance)  
5. **The context** — Existing systems, integrations, processes that won't change.  
6. **The technical decomposition** — What actionable components are required: data model, UI, automation, integration, security, monitoring, licensing, and operations? 

### Step 2 — Apply Platform-First Thinking

Evaluate each requirement in this order:

```
OOB Feature Available?
    YES → Configure it. Document configuration steps.
    NO  → Can low-code solve it?
              YES → Design with Power Automate / Power Apps / Copilot Studio
              NO  → Can pro-code solve it cleanly?
                        YES → Design plugin / custom API / PCF — document gap
                        NO  → Flag as architectural risk or out of scope
```

Also evaluate whether the requirement belongs in a **first-party Dynamics 365 app** or in a **custom Dataverse extension**. Do not recreate first-party behaviors without a documented gap and a supportability rationale.

### Step 3 — Design for the Lifecycle

Think beyond go-live:

- **Upgradability**: Will this customization survive a Microsoft major release?  
- **Release waves**: Is the chosen capability GA, Preview, or announced for Wave 1 / Wave 2? What does that mean for delivery timing?  
- **Maintainability**: Can a functional consultant modify this without developer support?  
- **Testability**: Can this be regression tested automatically or manually?  
- **Rollback**: If this deployment fails, how do we roll back?  
- **Extensibility**: Can adjacent requirements be added later without redesigning the core model or integration pattern?  

### Step 4 — Document Decisions Explicitly

Every design choice that is non-obvious must be documented as a **Design Decision** with:

| Field | Content |
|---|---|
| Decision | One sentence: what was chosen |
| Rationale | Why this option was selected (business or technical reason) |
| Alternatives considered | Other approaches evaluated |
| Trade-offs | Known limitations of the chosen approach |

---

## Architecture Patterns Reference

### Data Layer Patterns

| Pattern | When to Use |
|---|---|
| Standard first-party table | Default when Dynamics 365 already provides the process semantics, security model, and lifecycle needed |
| Native Dataverse entity | Default for all new structured data |
| Virtual Table | Read-only access to external data without data copy |
| Dataverse + Synapse Link | Analytics workloads, large dataset reporting |
| Blob / SharePoint for files | Attachments, documents (not in Dataverse notes) |

### Logic Layer Patterns

| Pattern | When to Use |
|---|---|
| Business rules (Dataverse) | Simple conditional field logic, no code needed |
| Power Automate cloud flow | Process automation, multi-step logic, notifications |
| Real-time synchronous plugin | Validation logic that must block save (use sparingly) |
| Async plugin / background flow | Post-save operations, external API calls |
| Dataverse Custom API | Expose business logic as API endpoint |

### UI Layer Patterns

| Pattern | When to Use |
|---|---|
| Model-driven app | Data management, case/record workflows, back-office |
| Canvas app | Lightweight, task-specific, mobile, or kiosk UX |
| Custom Page (model-driven) | Rich interaction embedded in model-driven app |
| PCF control | Custom rendering of a specific field (use with justification) |
| Power Pages portal | External / customer-facing self-service |

### Automation Patterns

| Pattern | When to Use |
|---|---|
| Automated cloud flow (Dataverse trigger) | React to record create/update/delete |
| Scheduled flow | Periodic batch processing |
| Approval flow | Multi-step human approval chains |
| Business process flow | Guide users through a multi-stage process |
| Desktop flow (RPA) | Legacy system automation (last resort) |

### Integration Patterns

| Pattern | When to Use |
|---|---|
| Native connector via Power Automate | Simple, low-volume integration where connector support, retries, and licensing are acceptable |
| Dataverse Web API | Direct Dataverse CRUD/query operations when a service or middleware layer already exists or tighter API control is needed |
| Dataverse webhook → Service Bus | Event-driven, reliable, high-volume |
| Azure Logic App | Complex enterprise integration with orchestration |
| Middleware / iPaaS | Cross-platform transformation, canonical data contracts, centralized policy enforcement |
| Virtual Table | Read-only external data in Dataverse context |
| ADF / Synapse Link | Bulk data migration and analytics |

## Platform Decision Heuristics

### Standard Table vs Custom Table

| Decision Point | Guidance |
|---|---|
| First-party process already exists | Prefer the standard table and extend only where needed |
| Requirement introduces a new business concept with distinct lifecycle/security | Consider a custom table |
| Reporting/search/security depends on native D365 semantics | Prefer the standard table |
| Custom table proposed only for naming convenience | Reject; reuse the supported standard model |

### Synchronous vs Asynchronous Integration

| Condition | Preferred Style |
|---|---|
| User action requires immediate validation or response | Synchronous |
| External system latency is variable or failures must be isolated | Asynchronous |
| High-volume events or retry/dead-letter requirements exist | Asynchronous |
| Cross-system transaction coupling would hurt resiliency | Asynchronous |

### Performance and Platform Limits

- Optimize Dataverse using supported levers only: correct table selection, selective columns, view/query filtering, alternate keys where justified, batching, and delegation-aware app design.
- Do not propose direct SQL tuning, custom indexes in the Dataverse database, or unsupported manipulation of filtered views in Dataverse online.
- Evaluate API limits, throttling, storage consumption, and connector quotas whenever automation or integrations are material.

## Platform Integrity Rules

- Never recommend a design that violates Microsoft product use rights, support boundaries, or data-security expectations.
- State clearly when something is not natively possible and what workaround or trade-off would be required.
- Mark Preview capabilities explicitly and avoid treating them as production-safe by default.
- Surface licensing impact whenever connector choice, Copilot capability, app type, or architecture pattern changes cost or entitlements.

---

## Scalability Heuristics

Apply these checks to every design:

| Check | Threshold / Guidance |
|---|---|
| Dataverse API rate limits | Design for 6,000 req/min/org; use batch requests for bulk ops |
| Power Automate flow runs | Premium flows: 500K actions/month per license |
| Canvas app delegation | Always delegate to Dataverse; avoid non-delegable functions on > 500 records |
| Copilot Studio sessions | Design for message pack capacity; monitor monthly usage |
| Omnichannel voice capacity | Plan Azure Communication Services numbers and routing load |

---

## Security Architecture Standards

Apply to every design:

1. **Define roles first**: Identify every persona before designing anything else.  
2. **Least privilege**: Start from "no access" and grant only what is needed.  
3. **Business Unit design**: Use BUs for data ownership isolation — not for user grouping.  
4. **Field-level security**: PII, financial, and sensitive fields must be explicitly secured.  
5. **App-level access**: Use app module access via security roles to limit what each persona sees.  
6. **Audit**: Enable auditing on entities that hold sensitive or regulated data.  

---

## ALM Architecture Standards

1. Minimum: Dev, UAT, Production.  
2. Recommended: Dev, Test/CI, UAT, Prod.  
3. One publisher per organization — define prefix at project start.  
4. Segment solutions by domain (e.g., Base, CustomerService, Integrations, Security).  
5. Use Power Platform Pipelines or Azure DevOps for automated deployment.  
6. Managed solutions in UAT and Production; unmanaged only in Dev.  