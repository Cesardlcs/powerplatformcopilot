# powerplatformcopilot

A Claude Code plugin that turns Claude Code into a Power Platform / Dynamics 365 solution-architecture assistant. It packages agents, skills, and reference docs — no application code, no build step — to help design Dataverse schemas, security roles, and high-level solution designs following out-of-the-box-first, least-privilege principles.

## What it does

- Interviews stakeholders one question at a time to build a shared, approved design concept before any work starts.
- Produces high-level solution designs, escalating from out-of-the-box configuration to low-code and then pro-code only as needed.
- Designs Dataverse schemas (standard vs. custom tables, columns, relationships) by inspecting a connected environment via PAC CLI and the Dataverse MCP server.
- Designs least-privilege Dataverse security roles starting from a baseline role, with privilege-dependency analysis and an explicit approval gate before anything is created.
- Routes Power Platform (Dataverse, Power Apps, Power Automate, Copilot Studio, Power Pages, AI Builder) and D365 Customer Service workspace (Omnichannel, Knowledge Management) work to the right specialist.

## Installation

This repo is a Claude Code plugin marketplace. Add it as a marketplace source pointing at `.claude-plugin/marketplace.json`, then install the `powerplatformcopilot` plugin it registers. See [Claude Code plugin docs](https://docs.claude.com/claude-code) for how to add a marketplace and install a plugin.

## Architecture

**Agents** (`plugins/powerplatformcopilot/agents/`)
- `solutions-architect` — orchestrator; takes requirements and delegates domain-specific design work by requirement-domain code.
- `power-platform-specialist` — Dataverse, Power Apps, Power Automate, Copilot Studio, Power Pages, AI Builder (`D-PA`, `D-APP`, `D-PVA`, `D-DV`, `D-PP`, `D-AI`).
- `d365-copilot-service-workspace-specialist` — D365 Customer Service workspace, Omnichannel, Knowledge Management (`D-CSW`, `D-OCH`, `D-KB`).

**Skills** (`plugins/powerplatformcopilot/skills/`)
- `interviewer` — runs before any project work; produces a "Simple Shared Design Concept" that must be explicitly approved.
- `solution-design` — the shared architectural decision framework (OOB → low-code → pro-code escalation, pattern tables, scalability heuristics, anti-patterns) applied by the agents.
- `data-model` (`/data-model`) — designs a Dataverse schema; presents the design via Plan Mode before writing anything.
- `security-model` (`/security-model`) — designs a least-privilege Dataverse security role via a numbered Step 1–10 flow, with an approval gate before creation.

**References** (`plugins/powerplatformcopilot/references/`)
- `solution-design-specifications.md` — governing HLD methodology.
- `security-role-proposal.md` — output template for security role proposals.

## Design principles

- Out-of-the-box configuration first, escalating to low-code and pro-code only when needed.
- Least-privilege, baseline-role-driven security design.
- Explicit GA-vs-Preview honesty for platform capabilities.
- ALM via environment variables and connection references.
- Non-trivial proposals go through Plan Mode with an explicit approval gate before creating or modifying anything in a connected environment.

## Repo layout

```
.claude-plugin/marketplace.json                 # marketplace manifest — registers the plugin
plugins/powerplatformcopilot/
  agents/            solutions-architect.md, power-platform-specialist.md,
                      d365-copilot-service-workspace-specialist.md, basic.md
  skills/            interviewer/, solution-design/, data-model/, security-model/
  references/        solution-design-specifications.md, security-role-proposal.md
```
