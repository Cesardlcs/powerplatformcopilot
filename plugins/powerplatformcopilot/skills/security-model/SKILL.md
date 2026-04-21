---
name: security-model
description: Design a Dataverse security role from a concrete purpose and access requirement. Always start from the Basic User security role, unless told otherwise, inspect existing reference roles named by the user, discover underlying dependent privileges needed to complete the intended business action, propose an exact least-privilege matrix, allow review and adjustment, and only then create a validating role if approved.
license: MIT
compatibility: Designed for GitHub Copilot CLI or Claude Code in Power Platform / Dataverse development projects. Requires PAC CLI >= 2.3.1.
metadata:
  author: Cdlcs
  version: "1.1.0"
  argument-hint: "[security role purpose or access requirement]"
---

# Dataverse Security Role Designer

**Triggers**: dataverse-security, security model, security roles, privileges, access levels, role hardening, least privilege
**Aliases**: /security-model, /dataverse-security, /security-roles

---

## Instructions

Follow these steps in order for every `/security-model` invocation.

### Governing Security Principles (Mandatory)

- **Mínimo privilegio**: Cada rol solo tiene los permisos necesarios para su función.
- **Zero Trust**: No se asume confianza implícita; todo acceso es verificado.
- **Baseline obligatorio**: Todo nuevo rol debe partir del rol `Basic User`; no se diseña desde cero ignorando ese baseline.
- **Objetivo exacto**: El rol debe permitir exactamente el resultado requerido y excluir privilegios no justificados.
- **Dependencias funcionales completas**: Siempre hay que identificar privilegios subyacentes necesarios para completar la acción principal, incluyendo tablas relacionadas, procesos, asignaciones, lookups, calendario, recursos, ownership, y acciones auxiliares.

### Step 1: Verify Environment

```powershell
pac auth list
pac auth who
pac env who
```

If there is no authentication, tell the user to run:

```powershell
pac auth create --environment https://your-env.crm.dynamics.com
```

Capture and report:
- Current user
- Environment ID
- Organization ID
- Organization Friendly Name

### Step 2: Collect Purpose, Requirement, And Constraints (Mandatory)

Ask these questions. The purpose and requirement questions are mandatory on every invocation:

1. **Purpose (always ask)**: "What is the exact purpose of the security role you need to create?"
2. **Requirement (always ask)**: "What actions must the user be able to complete end to end? Please describe the business flow, not only the obvious main table."
3. **Reference roles**: "Which existing security roles should be inspected as references? Provide the role names exactly as they exist in the environment."
4. **Scope constraints**: "Is this for end users, agents, integrations, or admins? Any boundaries for business unit, team, organization, ownership, or specific apps?"

Do not proceed to design until purpose, requirement, business case, reference-role, and scope constraint input state are explicit.

If the user does not name any reference roles, explicitly record that no reference roles were supplied and continue with environment discovery anyway.

### Step 3: Research Best Practices And Discover Current Security State

#### 3.1 Microsoft guidance (required)
- Use `mcp_microsoftdocs_microsoft_docs_search` to find current official guidance for:
  - Dataverse security model and privilege depth (User/Business Unit/Parent:Child BU/Organization)
  - Security role design and least privilege
  - Security-role copy or baseline strategy where relevant
  - Team vs user-owned access strategy where relevant
- Use `mcp_microsoftdocs_microsoft_docs_fetch` on high-value result pages before finalizing the proposal.

#### 3.2 Environment role inventory and baseline discovery (required)
- Confirm that `Basic User` exists in the connected environment and treat it as the mandatory baseline role for every new proposal, unless the user explicitly states otherwise.
- Inspect existing roles in the connected environment and identify:
  - The effective baseline privileges inherited from `Basic User`
  - Candidate roles that already align with the requested purpose
  - The user-supplied reference roles that must be compared in detail
- Use Dataverse MCP and/or PAC CLI as needed to gather:
  - Existing role names and intended purpose
  - Relevant privileges and depth
  - Business unit scope where applicable
  - Differences between `Basic User`, reference roles, and candidate matches

Prefer Dataverse MCP for metadata/data retrieval and PAC CLI for environment/session validation and supplemental checks.

If direct role query automation is not available in the current toolset, inspect existing roles through the Power Platform admin center:
1. Go to **Manage** > **Environments** > current environment.
2. Open **Settings**.
3. Open **Users + Permissions** > **Security roles**.
4. Review `Basic User`, the user-supplied reference roles, and candidate matching roles before deciding whether a new validating role is needed.

#### 3.3 Underlying privilege dependency analysis (required)
- Do not stop at the obvious requested action. Always decompose the requested outcome into the full functional chain needed for the user to complete the scenario successfully.
- For each requested business action, determine the underlying required privileges across:
  - Primary tables directly mentioned by the user
  - Related tables needed by lookups, ownership, booking engines, schedules, resources, calendars, work orders, service tasks, attachments, notes, queues, or process execution
  - Supporting actions such as Append, Append To, Assign, Share, Read, Write, Create, Delete, and any specialized privileges required by the process
  - System/process dependencies such as business process flows, custom actions, flows, plugins, app access, or team ownership where relevant
- Example rule: if the requested outcome is "create bookings," inspect the complete dependency chain and evaluate whether the user also needs access to bookable resources, calendars, work orders, service accounts, requirement groups, related lookups, and any other table or process needed for the booking transaction to succeed.
- The proposal must include privilege entries for both the main requirement and all validated underlying dependencies. If a dependency is considered but excluded, document why.

### Step 4: Propose The Role Plan (Before Any Creation)

Present a structured proposal in plan mode including:

1. **Role name**:
   - Must include the word `validating`.
   - Recommended format: `[purpose]-validating`.
2. **Baseline statement**:
   - Explicitly state that the role starts from `Basic User` or the user-specified baseline role.
   - State whether additional privileges are proposed beyond `Basic User` or the baseline role.
3. **Role objective** and explicit non-goals.
4. **Reference-role comparison**:
   - Which user-supplied roles were analyzed
   - Which privileges were reused as design evidence
   - Which privileges were intentionally not copied and why
5. **Privileges matrix** by table/process with:
   - Privilege type (Create, Read, Write, Delete, Append, AppendTo, Assign, Share, plus any special privileges as needed)
   - Access level/depth (User, BU, Parent:Child BU, Organization)
   - Source classification (`Basic User`, `Reference role`, `Newly required`, `Explicitly excluded`)
   - Dependency classification (`Primary requirement` or `Underlying dependency`)
   - Rationale tied to the purpose, requirement, business case, and least-privilege principle
6. **Segregation and risk controls**:
   - Least privilege justification (Mínimo privilegio)
   - Zero Trust verification points (what is explicitly validated before access is granted)
   - Sensitive actions explicitly denied or out of scope

### Step 5: Determine If An Existing Role Already Complies (Mandatory)

Before creating anything, provide a compliance check:

- Compare against `Basic User` plus the requested deltas, not only against standalone custom roles.
- List candidate existing roles that partially or fully match.
- State clearly one of:
  - **Compliant role exists** (no new role required), or
  - **No compliant role exists** (new validating role required).
- Include gap analysis when there is only partial alignment (missing/excess privileges, wrong depth, wrong scope).

### Step 6: Review And Adjustment Loop (Mandatory)

Before any approval request, present the draft plan and invite the user to review it.

The user must be able to:
- Confirm the role plan as-is
- Request privilege additions or removals
- Challenge access depth choices
- Ask for more evidence for a dependency or exclusion
- Provide more reference roles for comparison

If the user requests adjustments, update the plan and present the revised matrix again. Repeat this review loop until the user explicitly states that the plan is approved for creation or approved as final proposal only.

### Step 7: Explicit Approval Gate (Do Not Skip)

Ask for user approval after presenting:
- Purpose understanding
- Requirement understanding
- Baseline role statement (`Basic User` or user-specified baseline role)
- Reference-role comparison
- Proposed privilege matrix
- Existing-role compliance result
- Planned role name including `validating`

Do not create or modify roles before explicit approval.

### Step 8: Create The Role After Approval

Create the role in the connected environment using available MCP/PAC capabilities ONLY IF USER ASKS TO CREATE THE ROLE AFTER APPROVAL. If the user approved the plan but did not request creation, explicitly say that no role was created and the output is the approved design only.

1. Start from the `Basic User` security role as the base or the user-specified baseline role if different. Do not start from scratch or from an intermediate role that is not the baseline.
2. Create or clone into a new role with `validating` in the name.
3. Apply only the approved privilege deltas beyond `Basic User` or the baseline role.
4. Assign privileges exactly as approved (no implicit privilege inflation).
5. Set privilege depth exactly as approved.
6. Add/create the role inside the user-selected solution when the user asked for creation.
7. Confirm the created role and summarize applied privileges/depth.

If technical limitations block direct creation, provide the exact limitatios and try to go beyond them. If creation is blocked, still write the final output file and include blockers and exact next actions.

### Step 9: Final Output

Return a concise summary including:
- Environment confirmation (user, org, friendly name)
- Purpose and requirement interpreted
- Requirement and business case interpreted
- Baseline role confirmation (`Basic User` or user-specified baseline role)
- Reference roles analyzed
- Existing-role compliance outcome
- Role review outcome (approved as proposal only, or approved and created)
- Created validating role name
- Privilege/depth matrix actually implemented
- Underlying dependencies considered
- References to Microsoft documentation consulted

If the user approved the plan but did not request creation, explicitly say that no role was created and the output is the approved design only.

### Step 10: Persist Final Output File (Mandatory)

Always write the **Step 9 final output** to a file in an `output` folder.

Rules:
1. Create `security-model/output/` if it doesn't exist.
2. Write one markdown file per execution.
3. Recommended filename format: `security-model/output/[role-name].md`.
4. The file content must be the same final output delivered to the user in Step 9.
5. If role creation is blocked, still write the final output file and include blockers and exact next actions.

## Output Template (Use In Plan Mode Before Approval)

```markdown
## Security Role Proposal: [RolePurpose]-validating

**Environment**: [Friendly Name] ([Organization ID])
**Purpose**: [role purpose]
**Requirement**: [user requirement]
**Business Case**: [user business case]
**Baseline Role**: `Basic User` or user-specified baseline role
**Reference Roles Provided**: [role names or "None provided"]

### Existing Role Compliance Check
- [Role A]: [Compliant / Partial / Not compliant] - [why]
- [Role B]: [Compliant / Partial / Not compliant] - [why]

**Conclusion**: [Compliant role exists / No compliant role exists]

### Proposed Role
- **Role Name**: `[name-with-validating]`
- **Scope**: [User / BU / Parent:Child BU / Organization]
- **Starting Point**: Clone or extend `Basic User` or user-specified baseline role
- **Temporary Intent**: Validation only until tests and business sign-off are complete.

### Reference Role Analysis
| Reference Role | Relevant Privileges Reused | Privileges Intentionally Excluded | Notes |
|---|---|---|---|
| [Role A] | [list] | [list] | [why] |

### Privilege Matrix
| Table/Process | Privilege | Access Level | Include? | Source | Dependency Type | Rationale |
|---|---|---|---|---|---|---|
| bookableresourcebooking | Create | BU | Yes | Newly required | Primary requirement | [reason] |
| bookableresource | Read | BU | Yes | Underlying dependency | Underlying dependency | [reason] |
| msdyn_workorder | AppendTo | BU | Yes | Underlying dependency | Underlying dependency | [reason] |
| incident | Delete | User | No | Explicitly excluded | Risk control | [risk control reason] |

### Underlying Dependencies Considered
- [Dependency 1] - [Included/Excluded and why]
- [Dependency 2] - [Included/Excluded and why]

### Risk Controls
- [control 1]
- [control 2]

### Microsoft Guidance Referenced
- [doc title](url)
- [doc title](url)
```
