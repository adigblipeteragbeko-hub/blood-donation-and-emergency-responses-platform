# Implementation Backlog

## Scope
Translate approved clinical requirements v1 into delivery work for backend, frontend, data, security, and reporting.

## Priority Legend
- P0: Critical patient-safety and legal-compliance
- P1: High operational impact
- P2: Important optimization

## Phase Plan
- Phase 1 (Weeks 1-2): Emergency workflow, donor matching, alert escalation
- Phase 2 (Weeks 3-4): Live inventory + expiry controls + command center
- Phase 3 (Weeks 5-6): Compliance reporting + audit hardening + integration adapters

---

## Epic A: Auth, RBAC, and Safety Overrides
### A1. Strict role action matrix (P0)
- Implement endpoint and UI action matrix:
  - Admin-only operations
  - Hospital-staff operations
  - Donor-limited views
- Acceptance:
  - Unauthorized role returns 403
  - Admin override endpoints unavailable to non-admin users

### A2. Medical Director override workflow (P0)
- Add explicit override entity with reason, approver, timestamp, affected record.
- Acceptance:
  - Only Medical Director role can approve
  - Full immutable audit log entry generated

---

## Epic B: Emergency Request Lifecycle
### B1. Replace request statuses with approved clinical states (P0)
- Implement lifecycle:
  - Pending Verification
  - Matching in Progress
  - Donors Notified
  - Donor Confirmed (En Route)
  - Collected (In Lab)
  - Transfused/Completed
  - Cancelled (No Donor Found)
  - Cancelled (Patient Stabilized)
- Acceptance:
  - Every transition logged with user, timestamp, IP/geolocation

### B2. Completion legal definition enforcement (P0)
- Require encounter ID, nurse ID, and unit DIN before setting Transfused/Completed.
- Acceptance:
  - Hard validation prevents completion without all legal fields

### B3. Emergency one-click initiation mode (P1)
- Add Big Red Button flow with default “Massive Hemorrhage Protocol, Type Unknown”.
- Acceptance:
  - Request can be created in fewer than 3 interactions

---

## Epic C: Donor Matching and Eligibility Rules
### C1. Eligibility hard stops (P0)
- Enforce:
  - Last donation >= 56 days
  - Weight >= 50kg for standard donation
  - Not deferred
  - Safety flag constraints
- Acceptance:
  - Donor excluded automatically if rule violated
  - Override blocked except Medical Director path

### C2. Dynamic matching radius control (P1)
- Add instant radius selector with defaults by urgency:
  - 15km class 1
  - 40km standard emergency
- Acceptance:
  - DRO can expand radius with one click

### C3. Donor response SLA tracking (P1)
- Track 10-minute acceptance target and 15-minute digital response window.
- Acceptance:
  - Dashboard shows on-time vs late response counts

---

## Epic D: Notifications and Escalation
### D1. Tiered notification orchestration (P0)
- Tier 1 push, Tier 2 voice, SMS/email audit-only.
- Acceptance:
  - Alert delivery status per channel recorded

### D2. Escalation engine (P0)
- 2 reminders at 3-minute intervals
- Auto-escalate when critical request unaccepted by 3 donors after 10 minutes
- Notify Blood Bank Supervisor + Nurse Coordinator directly
- Acceptance:
  - Escalation events visible in audit log and notification history

---

## Epic E: Inventory and Expiry Controls
### E1. Live inventory state segmentation (P0)
- Separate counts by ABO/Rh and category:
  - Crossmatched/Held
  - Available
  - QC/Quarantine
- Acceptance:
  - Real-time count and nearest expiry shown for each group/category

### E2. Expiry risk alerting (P0)
- Add 72-hour and 24-hour alert triggers with redistribute/reallocate workflow.
- Acceptance:
  - Alerts created automatically and acknowledged by role user

### E3. Threshold rule engine (P1)
- Encode thresholds:
  - O-neg critical <12, standard <20
  - B-neg and AB-neg critical <5
  - Platelets critical <3
- Acceptance:
  - Threshold updates restricted to admin

---

## Epic F: Audit, Compliance, and Retention
### F1. Immutable audit ledger hardening (P0)
- Record user ID, action, record ID, IP/device, timestamp.
- Add tamper-evident controls and append-only policy.
- Acceptance:
  - No destructive edits in application layer

### F2. Scheduled compliance reports (P1)
- Weekly emergency lifecycle report
- Monthly donor response and wastage report
- Acceptance:
  - PDF and CSV export working with timestamp/user stamp

### F3. Retention policy scaffolding (P1)
- Donor retention >=10 years post-last donation
- Request/transfusion logs >=30 years or legal max
- Acceptance:
  - Archival policy documented and tested in non-prod

---

## Epic G: Integration Adapters
### G1. LIS adapter contracts (P1)
- Define FHIR/HL7 interface:
  - Inbound request events
  - Outbound DIN + donor code updates
- Acceptance:
  - Contract tests pass for payload schema

### G2. Central blood bank expiry feed (P1)
- One-way ingestion of expiry and inventory updates.
- Acceptance:
  - Import latency and failure retries instrumented

---

## Epic H: UX and Command Center
### H1. Mobilization Command Center (P1)
- Single view for active requests, matched donors, route status, escalation timers.
- Acceptance:
  - Replaces manual call-sheet workflow for DRO

### H2. Donor quick response interaction (P1)
- One-tap Accept/Decline plus quick intents.
- Acceptance:
  - Median response interaction under 5 seconds

### H3. KPI-first landing dashboard (P1)
- Widgets:
  - Active Matches in Transit
  - Inventory On Shelf vs Critical
  - Wastage Risk 24h
- Acceptance:
  - Widgets update in near real-time

---

## Technical Tasks
### Data and schema updates
- Add enum/state migrations for lifecycle statuses
- Add legal fields: encounterId, transfusingNurseId, unitDin
- Indexes for SLA and reporting queries

### Security and observability
- Rate limiting + structured error handling
- Action-level audit for all admin-sensitive endpoints
- Alerting hooks for critical failures and delivery misses

### Testing
- Unit tests for rule engine and hard stops
- Integration tests for auth, status transitions, escalation, inventory alerts
- E2E smoke tests for admin/donor/hospital login and main workflows

---

## Delivery Gates
### Gate 1
- All P0 items in Epics A-D implemented and tested

### Gate 2
- Inventory and expiry control features verified with scenario tests

### Gate 3
- Compliance reports and integration contracts validated

### Release Readiness
- KPI instrumentation active
- Runbook and rollback docs updated
- UAT signoff by Hospital Donor Services

