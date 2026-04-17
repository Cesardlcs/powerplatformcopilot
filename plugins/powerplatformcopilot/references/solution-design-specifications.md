# Solution Design Specification

> **Purpose:** This file defines the methodology, principles, design rules, and decision framework that agents and architects must follow when producing solution designs for Dynamics 365 Copilot Service workspace and Power Platform engagements.

---

## 1. Scope

This specification governs the design of **High-Level Solution Documents (HLD)** for:

- **Microsoft Dynamics 365 Copilot Service workspace** — case management, agent experience, knowledge, voice & digital channels, AI features  
- **Power Platform subdemands** — Power Apps (model-driven and canvas), Power Automate, Power Pages, Power Virtual Agents / Copilot Studio, Dataverse  
- **Integrations** — Dataverse, Azure services, third-party systems via connectors or APIs  

It does **not** govern low-level technical design, detailed code architecture, or infrastructure provisioning.

---

## 2. Design Philosophy

| Principle | Guidance |
|---|---|
| **Technical decomposition first** | Break business requirements into concrete technical capabilities, data impacts, integration points, security controls, and operational tasks before selecting a solution pattern. |
| **Out-of-the-box first** | Prefer native D365 / Power Platform capabilities before customization. Document the gap that drives every customization. |
| **Layered customization** | Extend via configuration → low-code → pro-code. Escalate only when necessary. |
| **Upgrade-path aware** | Favor approaches that remain supportable across Microsoft platform updates, release waves, and future extensibility scenarios. |
| **Release-wave aware** | Check Wave 1 / Wave 2 roadmap and current GA vs Preview state when feature availability affects the design. |
| **Solution-aware** | All customizations must live in a managed or unmanaged solution. Name and layer solutions correctly. |
| **First-party before custom app build** | Distinguish between first-party Dynamics 365 app capabilities and custom Dataverse applications; do not rebuild first-party behaviors without a justified gap. |
| **Security by design** | Define data access model (Business Units, Security Roles, Column Security, Teams) at design time. |
| **Scalability & supportability** | Design for future growth. Avoid point-to-point integrations; prefer event-driven / platform-native patterns. |
| **Platform-compliant performance** | Optimize with supported levers only: correct table choices, query design, alternate keys where justified, filtered views in the app layer, and selective columns. Do not propose unsupported SQL/database customization in Dataverse online. |
| **Licensing awareness** | Every design decision must be evaluated against its licensing impact (per-app, per-user, add-ons). |
| **Honest platform fit** | Explicitly say when a requirement is not possible natively, requires a workaround, depends on Preview, or has material platform limitations. |

---

## 3. Design Process

### Step 1 — Requirement Intake & Analysis

1. Receive requirements from uder input.
2. Analyze and decompose requirements into atomic, testable items.
3. Incorporate attachment-derived evidence from BO and Jira preprocessing (explicit and semantic references), with spreadsheet analysis across all worksheets/tabs.
4. Translate each requirement into actionable technical components: data model changes, UX needs, integration touchpoints, security controls, automation, and operations considerations.
5. Output: analyzed requirement list with domain grouping and traceability IDs.

### Step 2 — Architecture Scoping

1. Identify **domains** covered: Customer Service, Knowledge Management, Omnichannel, Field Service, Sales, Power Automate, Dataverse, etc.  
2. Identify **integration touchpoints**: external systems, data sources, identity providers.  
3. Identify **personas**: agents, supervisors, admins, customers, developers.  
4. Determine whether the solution should primarily use **first-party D365 capabilities** or a **custom Dataverse-based extension**, and document the gap when the latter is chosen.
5. Check **release-wave relevance**: current GA features, Preview dependencies, announced roadmap impact, and any likely upgrade-path constraints.
6. Define **deployment model**: online only, hybrid, multi-environment (Dev / Test / UAT / Prod).

### Step 3 — Component Design

For each requirement domain, design the following:

| Layer | What to design |
|---|---|
| **Data** | Entities, relationships, fields, forms, views — standard vs. custom, lifecycle fit, supported performance levers |
| **Logic** | Business rules, workflows (Power Automate), plugins (if needed), real-time vs. async, upgrade-safe extension points |
| **UX/UI** | App modules, dashboards, model-driven forms, canvas components, portals |
| **AI/Copilot** | Copilot Studio bots, AI Builder models, Copilot features in D365, GA vs. Preview status |
| **Integration** | Connectors, custom APIs, Dataverse virtual tables, Dataverse Web API, Azure Service Bus, Logic Apps, middleware, sync vs. async rationale |
| **Security** | Roles, BUs, field-level security, sharing rules, app-level access |
| **Operations** | ALM (solution layering), environment strategy, monitoring, support model, upgrade path, release-wave monitoring |

### Step 4 — Decision Documentation

Every significant design decision must be logged with:

- **Decision**: What was chosen  
- **Rationale**: Why it was chosen  
- **Alternatives considered**: What else was evaluated  
- **Trade-offs**: Limitations or risks of the chosen approach  

### Step 5 — Post-Design Implementation Classification

Classify:

1. A one-class-per-component rule (`Out of the box`, `Configuration - OOB`, `Low-Code`, `Advanced Low-Code`, `CUSTOM`).


---

## 4. Design Standards

### 4.1 Dynamics 365 Copilot Service Workspace

- Use the **Customer Service workspace** (multi-session) app as the primary agent interface.  
- Leverage **unified routing** for workstream and queue configuration.  
- Design **knowledge base** structure: categories, articles, feedback loops.  
- Define **SLA and entitlement** models when SLAs are a requirement.  
- Preserve first-party patterns where available; do not replace native case, queue, routing, SLA, or knowledge capabilities with custom constructs unless a validated gap exists.
- For AI: specify which **Copilot features** are enabled (case summarization, email draft, knowledge search) and any configuration or data readiness requirements.  
- For AI and Copilot features: identify whether each capability is GA or Preview, and note production suitability accordingly.
- For omnichannel: define channels (chat, voice, email, SMS, social) and their **escalation paths**.
- Ensure proposed customizations do not compromise platform updates, Microsoft supportability, or secure handling of customer data.

### 4.2 Power Platform

- Prefer **model-driven apps** for data-centric experiences; **canvas apps** for task-specific or mobile UX.  
- Use **Dataverse** as the data layer. Prefer standard tables when they satisfy lifecycle, security, and reporting needs; document the explicit reason whenever custom tables are introduced.  
- Document custom tables with schema names, display names, relationships, ownership model, and the reason a standard table was not used.
- Optimize with platform-supported data-model choices only: fit-for-purpose tables, selective columns, appropriate views, query filtering, and alternate keys where justified. Do not recommend unsupported SQL indexing, direct filtered-view customization, or direct database access changes in Dataverse online.
- Use **Power Automate cloud flows** for automation. Specify trigger, action steps, and error handling.  
- Use **Copilot Studio** for conversational AI (bots, topics, actions, knowledge sources).  
- Document **environment variables** and **connection references** for all flows and apps.
- Call out platform limits that materially affect the design, including API limits, connector throttling, storage impact, and delegation constraints.

### 4.3 Integration Design

- Prefer **Dataverse connectors** and **native integrations** over custom code.  
- Select the integration pattern explicitly based on latency, resiliency, throughput, ownership, and supportability: native connectors, Dataverse Web API, Power Automate, Azure Service Bus, Azure Logic Apps, or middleware.  
- Decide and document whether each integration is **synchronous** or **asynchronous**, with rationale tied to latency and failure-isolation needs.
- For real-time sync: evaluate **Dataverse webhooks**, **Service Bus**, **Dataverse Web API**, or **Azure Event Grid**.  
- For batch/ETL: evaluate **Data Export Service**, **Synapse Link**, or **Azure Data Factory**.  
- Document each integration with: source, destination, direction, frequency, authentication, error handling.
- Never recommend an integration pattern that violates Microsoft usage policies, weakens identity/security posture, or depends on unsupported direct database access.

### 4.4 Security Design

- Always define **Security Roles** per persona.  
- Apply the **principle of least privilege**.  
- Document **Business Unit** hierarchy if multi-BU is needed.  
- Specify **field-level security** for sensitive data (PII, financial).

### 4.5 ALM & Environment Strategy

- Minimum environments: **Dev → UAT → Production**.  
- All customizations in versioned, managed solutions in Production.  
- Define **publisher prefix** and **solution naming convention**.  
- Use **pipelines** (Power Platform Pipelines or Azure DevOps) for promotion.

---

## 5. Design Anti-Patterns to Avoid

| Anti-Pattern | Preferred Approach |
|---|---|
| Modifying default solution | Always use a custom solution |
| Hardcoding environment-specific values | Use environment variables |
| Using system administrator role for all users | Define least-privilege custom roles |
| Synchronous plugins for heavy operations | Use async plugins or Power Automate |
| Canvas app calling Dataverse with no delegation | Design for delegation from the start |
| Single-environment development | Maintain Dev/UAT/Prod separation |
| Rebuilding first-party D365 capability in custom tables/apps without a gap analysis | Use native D365 features first and document the justified extension gap |
| Recommending Preview-dependent production architecture without explicit risk acceptance | Prefer GA capabilities; flag Preview clearly and obtain explicit approval |
| Suggesting direct SQL/index/database tuning in Dataverse online | Use only Microsoft-supported platform optimization levers |

---

