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
- **Baseline obligatorio**: Todo nuevo rol debe partir del rol `Basic User` o el que el usuario indique; no se diseña desde cero ignorando ese baseline.
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
3. **Reference roles (always ask)**: "Which existing security roles should be inspected as references? Provide the role names exactly as they exist in the environment."
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
- Confirm that `Basic User` or the one indicated by the user exists in the connected environment and treat it as the mandatory baseline role for every new proposal, unless the user explicitly states otherwise.
- Inspect existing roles in the connected environment and identify:
  - The effective baseline privileges inherited from `Basic User` or the user-specified baseline role
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

- Compare against `Basic User` or the user-specified baseline role plus the requested deltas, not only against standalone custom roles.
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
- Proposed detailed privilege matrix
- Existing-role compliance result
- Planned role name including `validating`
- Use the Output Template (Use In Plan Mode Before Approval) in `/references/   security-role-proposal` to structure the proposal and ensure all points are covered

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

#### 8.1 Authentication for Role Creation (Mandatory)

Use **MSAL interactive popup authentication** to obtain a bearer token before calling the Dataverse Web API. Do not attempt device code flow, Azure CLI, or any other method first.

Steps:

```powershell
# 1. Locate the MSAL DLL bundled with the PAC CLI VS Code extension
$pacFolder = (Get-Command pac).Source | Split-Path
$msalDll = Get-ChildItem $pacFolder -Filter "Microsoft.Identity.Client.dll" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $msalDll) {
    # Fallback: search VS Code global storage
    $msalDll = Get-ChildItem "$env:APPDATA\Code\User\globalStorage" -Filter "Microsoft.Identity.Client.dll" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
}
Add-Type -Path $msalDll.FullName

# 2. Build the public client and acquire token interactively (browser popup)
$tenantId  = "<tenant-id-from-pac-auth-who>"
$clientId  = "1950a258-227b-4e31-a9cf-717495945fc2"   # Azure PowerShell public client
$orgUrl    = "<environment-url-from-pac-env-who>"      # e.g. https://org.crm4.dynamics.com/
$scope     = "$orgUrl.default"

$builder = [Microsoft.Identity.Client.PublicClientApplicationBuilder]::Create($clientId)
$builder = $builder.WithAuthority("https://login.microsoftonline.com/$tenantId")
$builder = $builder.WithDefaultRedirectUri()
$app     = $builder.Build()

Write-Host "A browser window will open. Please sign in to authorize Dataverse access." -ForegroundColor Cyan
$result = $app.AcquireTokenInteractive([string[]]@($scope)).ExecuteAsync().GetAwaiter().GetResult()
$token  = $result.AccessToken
Write-Host "Authenticated as $($result.Account.Username)" -ForegroundColor Green
```

```powershell
# 3. Apply privileges using AddPrivilegesRole Web API action
$roleId  = "<role-guid>"
$headers = @{
    "Authorization"    = "Bearer $token"
    "Content-Type"     = "application/json"
    "OData-MaxVersion" = "4.0"
    "OData-Version"    = "4.0"
}

# Depth values: "Basic" = User, "Local" = BU, "Deep" = Parent:Child BU, "Global" = Org
$privileges = @(
    @{ PrivilegeId = "<guid>"; Depth = "Local" },
    @{ PrivilegeId = "<guid>"; Depth = "Global" }
    # ... one entry per approved privilege
)

$body = @{ Privileges = $privileges } | ConvertTo-Json -Depth 5
$url  = "$orgUrl`api/data/v9.2/roles($roleId)/Microsoft.Dynamics.CRM.AddPrivilegesRole"
Invoke-RestMethod -Method Post -Uri $url -Headers $headers -Body $body | Out-Null
Write-Host "Privileges applied successfully." -ForegroundColor Green
```

If technical limitations block creation, still write the final output file and document blockers with exact next actions.

DO NOT MOVE TO STEP 9 UNTIL CREATION IS CONFIRMED OR EXPLICITLY SKIPPED.

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