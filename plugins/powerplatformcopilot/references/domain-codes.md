# Domain Codes

Every requirement is tagged with one or more domain codes. The `solutions-architect` agent uses the tags to choose which specialist agent designs the requirement.

`scripts/route_requirements.py` reads the table below. Each **Routing question** becomes one yes/no question for that code. Keep each question to one idea, and keep the table format (4 columns, one row per code).

| Code | Name | Owner agent | Routing question |
|---|---|---|---|
| D-PA | Power Automate | `power-platform-specialist` | Does this requirement need automation, a scheduled job, an approval, or a cloud flow that connects systems or reacts to events? |
| D-APP | Power Apps | `power-platform-specialist` | Does this requirement need a custom model-driven app, canvas app, or custom user interface for users to work in? |
| D-PVA | Copilot Studio | `power-platform-specialist` | Does this requirement need a conversational bot or copilot built in Copilot Studio (formerly Power Virtual Agents)? |
| D-DV | Dataverse | `power-platform-specialist` | Does this requirement need new or changed Dataverse tables, columns, relationships, business rules, or security roles? |
| D-PP | Power Pages | `power-platform-specialist` | Does this requirement need an external-facing portal or website for customers, partners, or the public, built in Power Pages? |
| D-AI | AI Builder | `power-platform-specialist` | Does this requirement need AI Builder models, such as document extraction, prediction, classification, or text analysis? |
| D-CSW | Customer Service workspace | `d365-copilot-service-workspace-specialist` | Does this requirement concern the Dynamics 365 Customer Service workspace, such as cases, queues, routing rules, entitlements, SLAs, or agent productivity tools? |
| D-OCH | Omnichannel | `d365-copilot-service-workspace-specialist` | Does this requirement concern Omnichannel for Customer Service, such as live chat, voice, SMS, social channels, or workstreams? |
| D-KB | Knowledge Management | `d365-copilot-service-workspace-specialist` | Does this requirement concern knowledge articles, their authoring and approval, or search of knowledge for agents or customers? |

## Rules

- One requirement can have more than one code. The script lists every code whose yes-probability passes the threshold.
- The script also picks one **primary** code (the best single fit), or `none` if nothing fits.
- A requirement with no code, or a low-confidence primary code, gets `needs_review: true`. Ask the user. Do not guess.
- Requirements that match none of these codes (for example, a pure integration or licensing question) stay with `solutions-architect`.
