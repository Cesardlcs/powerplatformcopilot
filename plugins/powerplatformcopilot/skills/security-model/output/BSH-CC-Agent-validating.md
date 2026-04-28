# Security Role Final Output: BSH CC Agent - validating

**Date**: 2026-04-28
**Executed by**: dee7mu@bosch.com

---

## Environment

| Field | Value |
|---|---|
| **Organization Friendly Name** | bsh-paramount-DEV-CC |
| **Organization ID** | 5d64560b-62aa-f011-8704-000d3a69df60 |
| **Environment ID** | bfcd33ae-05d9-eef6-9c36-4470d4c0e855 |
| **Environment URL** | https://bsh-paramount-dev-cc.crm4.dynamics.com/ |
| **User** | dee7mu@bosch.com |

---

## Purpose and Requirement

| | |
|---|---|
| **Purpose** | Contact Center Agent — full lifecycle from Omnichannel conversation to field appointment booking |
| **Requirement** | Agent receives a conversation in Omnichannel → looks up or creates Contact + Account → looks up or creates Customer Assets → creates Functional Locations for assets/contacts/accounts → creates Cases linked to customer assets → creates Billing Functional Locations for cases → interacts with Activities and Timeline → creates and updates Repair Batches → converts Case to Work Order → opens Work Order → creates a Booking by selecting a Bookable Resource and time slot |
| **Scope** | Cross-Business Unit (agents move across BUs) |

---

## Baseline Role

`BSH Contact Center - Agent` (roleid: `cab1d897-b908-f111-8406-000d3abe0679`)

User-specified baseline. Not Basic User.

---

## Reference Roles Analyzed

| Role | Relevant Privileges Used | Privileges Intentionally Excluded | Notes |
|---|---|---|---|
| `BSH Contact Center - Agent` | All existing WO, Case, Asset, FuncLoc, RepairBatch, Omnichannel privileges | — | Full baseline |
| `BSH CC Agent - validating` (pre-existing) | All above | `prvAppendmsdyn_cannedmessage` was accidentally missing | Previous incomplete iteration — updated |
| `BSH Contact Center - Scheduler` | Booking CRUD pattern (used as design evidence for depth and privilege selection) | Agreement bookings, Quote bookings, Booking alerts, Booking journal, Booking rules, Scheduling board admin | Scheduler is over-privileged for agents; only booking transaction privileges were adopted at BU depth |

---

## Existing Role Compliance Check

| Role | Status | Gap |
|---|---|---|
| `BSH Contact Center - Agent` | **Partial** | Has WO + Case CRUD, but missing booking Create/Write/AppendTo |
| `BSH CC Agent - validating` (before this run) | **Partial** | Clone of baseline — same booking gap + missing `prvAppendmsdyn_cannedmessage` |
| `BSH Contact Center - Scheduler` | **Over-privileged** | Org-level booking + agreement/quote booking privileges not appropriate for agents |

**Conclusion**: No compliant role existed. `BSH CC Agent - validating` was updated with the approved delta.

---

## Role Review Outcome

**Approved and applied.** User approved the privilege matrix and requested creation.  
Role updated: `BSH CC Agent - validating` (roleid: `35a4e909-db3d-f111-88b5-000d3abe0679`)

---

## Privilege Delta Applied (additions beyond BSH Contact Center - Agent baseline)

**Depth key**: `BU` = Business Unit (privilegedepthmask: 2) | `Org` = Organization (privilegedepthmask: 8)

| Privilege | Table / Entity | Depth | Dependency Type | Rationale |
|---|---|---|---|---|
| `prvCreateBookableResourceBooking` | bookableresourcebooking | BU | Primary requirement | Agent must create a booking when scheduling the field appointment |
| `prvWriteBookableResourceBooking` | bookableresourcebooking | BU | Primary requirement | Agent may reschedule or update an existing booking |
| `prvAppendToBookableResourceBooking` | bookableresourcebooking | BU | Primary requirement | Needed so Work Order can reference the booking record |
| `prvCreateBookableResourceBookingHeader` | BookableResourceBookingHeader | BU | Underlying dependency | Header record is auto-created alongside booking |
| `prvReadBookableResourceBookingHeader` | BookableResourceBookingHeader | Org | Underlying dependency | Header is a reference entity; Org-read required to display correctly |
| `prvWriteBookableResourceBookingHeader` | BookableResourceBookingHeader | BU | Underlying dependency | Header is updated when booking is modified |
| `prvAppendBookableResourceBookingHeader` | BookableResourceBookingHeader | BU | Underlying dependency | Required for header-to-booking relationship |
| `prvAppendToBookableResourceBookingHeader` | BookableResourceBookingHeader | BU | Underlying dependency | Required for booking-to-header reference |
| `prvReadmsdyn_schedulingparameter` | msdyn_schedulingparameter | Org | Underlying dependency | URS scheduling panel requires Read on this entity to open the booking form from a Work Order |
| `prvAppendmsdyn_cannedmessage` | msdyn_cannedmessage | Org | Baseline fix | Present in `BSH Contact Center - Agent` but accidentally absent from previous validating iteration; needed for Omnichannel pre-built agent responses |

### Explicitly Excluded (Round 1)

| Privilege | Reason |
|---|---|
| `prvDeleteBookableResourceBooking` | Risk control: only Schedulers/Supervisors cancel bookings |
| `prvAssignBookableResourceBooking` | Risk control: ownership changes not needed for agents |
| Agreement/Quote Booking tables | Agents don't manage agreements or quotes |
| `msdyn_bookingrule` | Scheduling board admin — not needed for agents |
| `prvWritemsdyn_bookingsetupmetadata` | Configuration table — agents read only, not admin |

---

## Round 2 — Book Button Visibility Fix

**Issue**: After Round 1, the `BSH CC Agent - validating` could not see the **Book** button on Work Order records.  
**Root cause**: URS (Universal Resource Scheduling) reads `msdyn_bookingsetupmetadata` at Org level to decide whether to render the Book button per entity. The role had zero access to this table and to several URS framework entities required by the booking panel.

### Additional Delta Applied (Round 2)

| Privilege | Table / Entity | Depth | Dependency Type | Rationale |
|---|---|---|---|---|
| `prvReadmsdyn_bookingsetupmetadata` | msdyn_bookingsetupmetadata | Org | Underlying dependency | **Critical for Book button visibility** — URS reads this to configure the booking panel per entity |
| `prvAppendmsdyn_bookingsetupmetadata` | msdyn_bookingsetupmetadata | Org | Underlying dependency | Required by URS booking panel framework when processing booking setup |
| `prvAppendTomsdyn_bookingsetupmetadata` | msdyn_bookingsetupmetadata | Org | Underlying dependency | Required for booking setup metadata relationship |
| `prvWritemsdyn_resourcerequirement` | msdyn_resourcerequirement | BU | Primary requirement | Write access needed when the booking panel creates/updates the resource requirement |
| `prvReadmsdyn_resourcerequirementdetail` | msdyn_resourcerequirementdetail | Org | Underlying dependency | Requirement detail is read by the booking panel to understand resource constraints |
| `prvCreatemsdyn_resourcerequirementdetail` | msdyn_resourcerequirementdetail | BU | Underlying dependency | Created when resource requirement is generated during booking |
| `prvWritemsdyn_resourcerequirementdetail` | msdyn_resourcerequirementdetail | BU | Underlying dependency | Updated during booking panel execution |
| `prvAppendmsdyn_resourcerequirementdetail` | msdyn_resourcerequirementdetail | BU | Underlying dependency | Links detail to parent requirement |
| `prvAppendTomsdyn_resourcerequirementdetail` | msdyn_resourcerequirementdetail | BU | Underlying dependency | Allows requirement to reference detail |
| `prvReadmsdyn_schedulingfeatureflag` | msdyn_schedulingfeatureflag | Org | Underlying dependency | URS reads feature flags to render scheduling UI components |
| `prvAppendmsdyn_schedulingfeatureflag` | msdyn_schedulingfeatureflag | Org | Underlying dependency | Feature flag state is updated by the platform during scheduling |
| `prvAppendTomsdyn_schedulingfeatureflag` | msdyn_schedulingfeatureflag | Org | Underlying dependency | Feature flag cross-reference |
| `prvAppendmsdyn_schedulingparameter` | msdyn_schedulingparameter | Org | Underlying dependency | Scheduling parameter append required by URS processing |
| `prvAppendTomsdyn_schedulingparameter` | msdyn_schedulingparameter | Org | Underlying dependency | Scheduling parameter cross-reference |
| `prvReadmsdyn_bookingchange` | msdyn_bookingchange | Org | Underlying dependency | System-written audit log of booking changes; Read needed for timeline/tracking |
| `prvReadmsdyn_bookingjournal` | msdyn_bookingjournal | Org | Underlying dependency | Time journal of booking events; system-written, agent reads |
| `prvReadmsdyn_bookingtimestamp` | msdyn_bookingtimestamp | Org | Underlying dependency | Booking timestamp audit; system-written, agent reads |

### Explicitly Excluded (Round 2)

| Privilege | Reason |
|---|---|
| `prvWritemsdyn_bookingsetupmetadata` | Configuration admin privilege — agents read booking setup, do not modify it |
| `prvCreatemsdyn_bookingsetupmetadata` | Admin-only — booking setup configuration is managed by system admins/schedulers |

---

## Round 3 — Booking Save & Schedule Panel Errors (Manually Applied)

**Issue**: After Round 2, the Book button was visible but saving a booking and loading the scheduling panel triggered a cascade of missing-privilege errors.  
**Root cause**: The URS scheduling panel (WebResource `msdyn_/ScheduleBoard/index.html`) loads a broader set of reference entities at panel open time. Several system/configuration tables and depth upgrades were needed to allow the booking transaction to complete.

> **Note**: All privileges in this round were identified via browser console errors on the Work Order record and applied manually by the user.

### Additional Delta Applied (Round 3)

| Privilege | Privilege ID | Table / Entity | Depth | Dependency Type | Rationale |
|---|---|---|---|---|---|
| `prvReadmsdyn_scheduleboardsetting` | `65a5e3a4-d986-4f24-a3d9-7ef5017797f3` | msdyn_scheduleboardsetting (Schedule Board Setting) | Org | Underlying dependency | URS panel reads board settings to configure the scheduling UI |
| `prvReadmsdyn_requirementgroup` | `6234a73a-6a30-4b00-96ee-90970b0cca9c` | msdyn_requirementgroup (Requirement Group) | Org | Underlying dependency | Booking panel reads requirement groups to evaluate resource matching |
| `prvReadmsdyn_requirementstatus` | `21644755-7f7d-429f-8d0b-9c93a4199c35` | msdyn_requirementstatus (Requirement Status) | Org | Underlying dependency | Booking panel reads requirement status reference data |
| `prvAppendTomsdyn_requirementstatus` | `3ad93e37-22b0-4fa2-bcb8-3f300b731606` | msdyn_requirementstatus (Requirement Status) | Org | Underlying dependency | Required to link the resource requirement to a status record during booking |
| `prvReadBookableResourceGroup` | `d0d6ea1c-cdaf-4673-8424-0418c5421234` | bookableresourcegroup (Bookable Resource Group) | Org | Underlying dependency | Panel reads resource group memberships to display available resources |
| `prvReadmsdyn_bookingalertstatus` | `d84f3af1-c3d8-4579-a345-1e3a294f3f17` | msdyn_bookingalertstatus (Booking Alert Status) | Org | Underlying dependency | URS panel reads booking alert status reference table on load |
| `prvReadmsdyn_bookingrule` | `3e753c82-e3f7-4f51-a7c3-67188c0f2ab9` | msdyn_bookingrule (Booking Rule) | Org | Underlying dependency | Panel reads booking rules to apply validation constraints; Read-only — no create/write/delete |
| `prvAppendToBookingStatus` *(depth upgrade)* | `d883935a-0826-4278-8bdc-c7346ed75287` | bookingstatus (Booking Status) | **Org** *(was BU)* | Depth correction | BookingStatus records are owned by the root BU; BU-level AppendTo was insufficient to link the new booking to the system status record |
| `prvAppendToBookableResource` | `4e62b5c7-6dc4-44f4-80d1-04a936bfee04` | bookableresource (Bookable Resource) | Org | Underlying dependency | Required to create the relationship between the booking and the selected bookable resource |
| `prvAppendResourceBookingDetail` | `e36189a4-24b9-4236-9248-32ddb8f48fa5` | bookableresourcebooking (Bookable Resource Booking) | Org | Underlying dependency | Internal Append privilege on the booking entity required during booking commit |
| `prvCreatemsdyn_bookingchange` | `b7ee5a25-2a87-400b-9457-3ad921b51db7` | msdyn_bookingchange (Booking Change) | Org | Underlying dependency | System writes a booking change record when a booking is created or modified; Create required at Org because records are owned by root BU |
| `prvCreatemsdyn_bookingtimestamp` | `370757a8-3020-4b89-8311-88e30f033f5e` | msdyn_bookingtimestamp (Booking Timestamp) | Org | Underlying dependency | System writes a timestamp record on booking create/update; owned by root BU |
| `prvAppendmsdyn_bookingtimestamp` | `4f748930-11df-47e4-90f9-2c3ad388de31` | msdyn_bookingtimestamp (Booking Timestamp) | Org | Underlying dependency | Timestamp linked to booking record during commit |
| `prvReadmsdyn_organizationalunit` | `e6941bab-1017-45b1-bb4d-6a24119c262a` | msdyn_organizationalunit (Organizational Unit) | Org | Underlying dependency | URS uses org units for resource costing and matching; panel reads this on load |
| `prvAppendTomsdyn_workordersubstatus` | *(via env)* | msdyn_workordersubstatus (Work Order Substatus) | Org | Underlying dependency | Work Order substatus is updated when booking is created from WO; system-owned reference record |
| `prvReadbshcs_casestatusmapping` | *(via env)* | bshcs_casestatusmapping (BSH Case Status Mapping) | Org | Underlying dependency | Custom BSH table read during CC Agent case/WO workflow; Read-only |

### Observation — Round 3 Pattern

> The booking transaction touches ~20 system-owned reference tables (owned by the **root BU**, not the user's BU). This is a recurring URS pattern: privileges granted at **BU depth** are consistently insufficient for these tables. Any future role designed for booking from Work Orders should default to **Org Read** on all URS reference entities.

---

## Underlying Dependencies Considered

| Dependency | Decision | Rationale |
|---|---|---|
| `bookableresourcebooking` Create/Write/AppendTo | ✅ Included | Core missing capability |
| `BookableResourceBookingHeader` CRUD | ✅ Included | Platform auto-manages alongside booking records |
| `msdyn_schedulingparameter` Read | ✅ Included | Required by URS to open booking panel |
| `bookableresource` Read | ✅ Already in baseline | `prvReadBookableResource` at Org level was already present |
| `msdyn_resourcerequirement` Create/Append/AppendTo | ✅ Already in baseline (Read/Create/Append/AppendTo); Write added Round 2 | Present in `BSH Contact Center - Agent`; Write needed by booking panel |
| `bookingStatus` Read | ✅ Already in baseline | Present at BU level |
| `msdyn_bookingsetupmetadata` Read/Append/AppendTo | ✅ Included Round 2 | Critical for Book button visibility; URS reads this to configure booking panel |
| `msdyn_resourcerequirementdetail` CRUD | ✅ Included Round 2 | Required by URS booking panel execution |
| `msdyn_schedulingfeatureflag` Read/Append/AppendTo | ✅ Included Round 2 | URS framework reads feature flags for scheduling UI |
| `msdyn_schedulingparameter` Append/AppendTo | ✅ Included Round 2 | URS framework processing (Read was already present from Round 1) |
| `msdyn_bookingchange`, `msdyn_bookingjournal`, `msdyn_bookingtimestamp` Read | ✅ Included Round 2 | System-written audit tables; agent needs Read for timeline and tracking |
| `msdyn_bookingchange` Create / `msdyn_bookingtimestamp` Create+Append | ✅ Included Round 3 | System writes these on booking save; Create needed because records are root-BU owned |
| `msdyn_bookingrule` Read | ✅ Included Round 3 (Read only) | Previously excluded as admin; Read-only required by URS panel on load |
| `msdyn_bookingalertstatus` Read | ✅ Included Round 3 | URS panel reads this reference table on load |
| `msdyn_scheduleboardsetting` Read | ✅ Included Round 3 | URS panel reads board settings to render the scheduling UI |
| `msdyn_requirementgroup` Read | ✅ Included Round 3 | Booking panel evaluates requirement groups for resource matching |
| `msdyn_requirementstatus` Read + AppendTo | ✅ Included Round 3 | Reference status linked to requirement during booking |
| `bookableresourcegroup` Read | ✅ Included Round 3 | Panel reads resource group memberships |
| `bookableresource` AppendTo | ✅ Included Round 3 | Links booking to the selected bookable resource |
| `bookableresourcebooking` Append (prvAppendResourceBookingDetail) | ✅ Included Round 3 | Internal Append required on booking entity during commit |
| `bookingstatus` AppendTo depth upgrade (BU → Org) | ✅ Depth corrected Round 3 | Status records owned by root BU; BU depth was insufficient |
| `msdyn_organizationalunit` Read | ✅ Included Round 3 | URS uses org units for resource costing; loaded on panel open |
| `msdyn_workordersubstatus` AppendTo | ✅ Included Round 3 | WO substatus updated when booking is created from WO |
| `bshcs_casestatusmapping` Read | ✅ Included Round 3 | Custom BSH table accessed during CC Agent case/WO workflow |
| Agreement/Quote Booking tables | ❌ Excluded | Scheduler territory — not needed by agents |
| Booking Delete | ❌ Excluded | Risk control |
| `msdyn_bookingsetupmetadata` Write/Create | ❌ Excluded | Admin configuration — agents do not modify booking setup |
| `msdyn_bookingrule` Write/Create/Delete | ❌ Excluded | Admin only — only Read granted |

---

## Risk Controls

- **Zero Trust on booking Delete**: explicitly excluded — booking cancellation must go through a Scheduler
- **Zero Trust on Scheduler board admin**: `msdyn_bookingrule` Write/Create/Delete excluded; Read-only granted for panel load
- **Zero Trust on booking setup admin**: `msdyn_bookingsetupmetadata` Write/Create excluded
- **BU-level depth on transactional tables**: agents only see/modify records within their Business Unit
- **Org-level Read-only on URS framework tables**: all URS reference/config tables (bookingsetupmetadata, schedulingfeatureflag, schedulingparameter, scheduleboardsetting, requirementgroup, requirementstatus, bookingalertstatus, bookingrule, organizationalunit) granted Read at Org; no write/create/delete
- ⚠️ **URS root-BU pattern**: All URS system reference tables (bookingstatus, requirementstatus, workordersubstatus, bookingchange, bookingtimestamp, etc.) are owned by the root Business Unit. Privileges on these tables must be at **Org level** to work — BU-level consistently fails. Future roles for booking from Work Orders should default to Org Read on all URS reference entities.
- ⚠️ **Cross-BU access risk**: User stated agents "move across business units." Current baseline uses BU-level (mask 2) for all transactional tables (WO, Incident, Booking). If agents need to create or read Work Orders/Bookings **across BUs**, the depth on those tables must be elevated to **Parent:Child BU (mask 4)** or **Organization (mask 8)**. This is a separate design decision outside the scope of this execution.

---

## Microsoft Documentation Referenced

- [Set up users, licenses, and security roles — Field Service](https://learn.microsoft.com/en-us/dynamics365/field-service/users-licenses-permissions)
- [Security roles and column-level security profiles — Field Service roles](https://learn.microsoft.com/en-us/dynamics365/field-service/security-permissions)
- [Access controls for Dataverse and Power Platform](https://learn.microsoft.com/en-us/power-platform/admin/security-roles-privileges)
- [Assign roles and enable users — Customer Service / Contact Center](https://learn.microsoft.com/en-us/dynamics365/customer-service/implement/add-roles-assign-users)
