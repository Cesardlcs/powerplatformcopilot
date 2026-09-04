# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository purpose

This repo is the source for a **Claude Code plugin** (`powerplatformcopilot`) distributed via a marketplace manifest. It packages agents, skills, and reference docs that turn Claude Code into a Power Platform / Dynamics 365 solution-architecture assistant. There is no application code, no package.json, no build step, and no test suite — every "component" is a Markdown file with YAML frontmatter that Claude Code loads as an agent or skill definition. Changes here are almost always edits to those Markdown definitions.

## Commands

None. There is nothing to build, lint, or test in this repository.

## Architecture

```
.claude-plugin/marketplace.json                 # marketplace manifest — registers the plugin
plugins/powerplatformcopilot/
  agents/            solutions-architect.md, power-platform-specialist.md,
                      d365-copilot-service-workspace-specialist.md, basic.md
  skills/            interviewer/, solution-design/, data-model/, security-model/
  references/        solution-design-specifications.md, security-role-proposal.md
```

**Agent hierarchy.** `solutions-architect` is the orchestrator: it takes raw/analyzed requirements and delegates domain-specific design work to two specialist subagents based on requirement-domain codes:
- `power-platform-specialist` — Dataverse, Power Apps, Power Automate, Copilot Studio, Power Pages, AI Builder (domains `D-PA`, `D-APP`, `D-PVA`, `D-DV`, `D-PP`, `D-AI`)
- `d365-copilot-service-workspace-specialist` — D365 Customer Service workspace, Omnichannel, Knowledge Management (domains `D-CSW`, `D-OCH`, `D-KB`)

Every agent file follows the same frontmatter + section convention: `name`/`description`/`author`/`color` frontmatter, then `Identity`, `Inputs`, `Outputs`, `Skills Used`, and `Tools Used` tables. Preserve this structure when adding or editing an agent.

**Skills invoked by the agents:**
- `interviewer` — runs before any project work; interviews the user one question at a time (pre-filling answers from codebase evidence) and produces a "Simple Shared Design Concept" that must be explicitly approved before anything else is created.
- `solution-design` — not a standalone user-facing flow but the shared architectural decision framework (OOB → low-code → pro-code escalation, data/logic/UX/integration pattern tables, scalability heuristics, anti-patterns) that `solutions-architect` and both specialists apply when designing.
- `data-model` (`/data-model`) — designs a Dataverse schema: inspects the environment via PAC CLI + Dataverse MCP, proposes standard-vs-custom tables/columns/relationships, and must present the design via `EnterPlanMode` before anything is written. Writes generated docs to `data-model/output/`.
- `security-model` (`/security-model`) — designs a least-privilege Dataverse security role starting from the `Basic User` baseline (or a user-specified baseline), using the numbered Step 1–10 flow (environment check → gather purpose/requirement/reference roles → research via Dataverse MCP/microsoftdocs-mcp → privilege-dependency analysis → proposal in Plan Mode using the template in `references/security-role-proposal.md` → explicit approval gate → creation only if requested → persist final output to `skills/security-model/output/`). Never skip the approval gate before creating/modifying a role.

**References** are shared templates/specs pulled in by name from skills, not code: `references/security-role-proposal.md` is the exact output template `security-model/SKILL.md` Step 7 points to; `references/solution-design-specifications.md` is the governing HLD methodology (design philosophy, process steps, per-layer standards, anti-patterns) that `solution-design/SKILL.md` and the agents build on.

**Skill file convention.** Frontmatter: `name`, `description`, `license`, `compatibility`, `metadata.author`/`version`/`argument-hint`, plus a `Triggers`/`Aliases` header and numbered `### Step N` instructions. Skills that produce artifacts write them to an `output/` subfolder next to the skill itself (e.g. `skills/security-model/output/`, `data-model/output/`).

**Recurring design principles** enforced across every skill and agent — apply them when extending this plugin, not just when it's designing a customer solution: out-of-the-box-first before low-code/pro-code escalation, least-privilege/baseline-role security design, explicit GA-vs-Preview honesty, environment variables and connection references for ALM, and presenting non-trivial proposals via Plan Mode with an explicit approval gate before creating or modifying anything in a connected environment.
