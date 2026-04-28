# Security Role Proposal

> **Purpose:** This file defines the template for the security role proposal.

---

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