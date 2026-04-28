# Clinical Requirements v1

## Document Control
- Owner: Senior Administrator, Hospital Donor Services
- Audience: Implementation Team, Product Design Partners
- Version: v1.0
- Date: 2026-04-28
- Status: Approved for implementation planning

## 1. Operational Objective
Dual mandate:
- Zero-delay emergency response
- Zero-waste inventory management

## 2. Validated Current Workflow
1. Emergency request is triggered by verified phone call from attending physician or charge nurse.
2. Call origin must be hospital-issued line or pre-registered mobile number.
3. On-call transfusion medicine specialist gives verbal approval.
4. Lab scientist initiates cross-match compatible unit search.
5. Donor Request Officer (DRO) closes request when units are dispatched or transfused with physical/electronic signoff.

### Key Bottlenecks
- Manual donor phone tree for rare and mass-casualty needs.
- Non-digitized approval sign-offs for emergency uncrossmatched blood release.

## 3. Donor Matching Requirements
### Mandatory criteria
- ABO/Rh compatibility (non-negotiable)
- Eligibility triage:
  - Last donation date must be greater than 56 days for whole blood
  - Permanent/temporary deferral status
  - Safety flag (e.g., recent travel to endemic zones)
- Secondary criteria:
  - Distance
  - Self-reported wellness

### Dynamic radius by urgency
- Class 1 (minutes to spare): 15km
- Standard emergency (about 2-hour window): 40km
- UI must allow DRO to expand radius with one control.

### Response SLAs
- Donor digital acceptance target: within 15 minutes
- Emergency push acceptance target: within 10 minutes

## 4. Inventory Operations Requirements
### Live data views
- On-shelf count by ABO/Rh
- Segregation:
  - Crossmatched/Held
  - Available
  - QC/Quarantine
- Nearest-expiring unit date visible per category

### Inventory event behavior
- Additions via barcode scan after serology clearance
- Deductions automated on electronic crossmatch to patient ID
- Expiry alerts:
  - 72-hour pre-expiry
  - 24-hour pre-expiry
- Trigger: redistribute/reallocate workflow

### Low-stock thresholds
- O-negative:
  - Critical: less than 12
  - Standard alert: less than 20
- B-negative and AB-negative:
  - Critical: less than 5
- Platelets:
  - Critical: less than 3 units (any type)

## 5. Request Tracking Requirements
### Required statuses
- Pending Verification
- Matching in Progress
- Donors Notified
- Donor Confirmed (En Route)
- Collected (In Lab)
- Transfused/Completed
- Cancelled (No Donor Found)
- Cancelled (Patient Stabilized)

### Mandatory status logs
Each status update must include:
- User ID
- Exact timestamp
- Geolocation or workstation IP

For Transfused status, additionally required:
- Transfusing nurse ID
- Unit DIN (Donation Identification Number)

### Completion definition
"Successfully completed" means:
- Unit electronically signed as Transfused
- Linked to specific patient encounter ID

## 6. Notifications and Escalation
### Channels
- Tier 1: persistent loud push notification
- Tier 2: automated voice call (TTS)
- SMS/email: audit trail, not primary emergency mechanism

### Escalation policy
- 2 reminders, 3 minutes apart
- If critical request remains unaccepted by 3 matched donors within 10 minutes, auto-escalate
- Escalation targets:
  - Blood Bank Supervisor
  - Hospital Nurse Coordinator on duty

## 7. Role and Access Control
### Admin-only
- Override deferral status
- Manual physical inventory adjustment after incidents
- View full donor identifiers pre-match
- Modify low-stock threshold logic

### Hospital staff
- Initiate and verify requests
- View donor match status and ETA
- Confirm transfused
- Must not view donor personal contact details or full name during active requests

### Donor view
- Show:
  - Hospital name
  - Anonymized urgency condition
  - Required blood type
  - Donation center map pin
- Hide:
  - Patient name
  - Bed number
  - Diagnosis code

### Safety valve
- Medical Director override is the only override path for restricted hard stops.

## 8. Compliance, Audit, and Retention
### Required reports
- Weekly Emergency Request Lifecycle Report (Transfusion Committee)
- Monthly Donor Response and Wastage Report (Regulatory)

### Immutable audit requirement
Track:
- User ID
- Action
- Record ID
- IP address or device ID
- Timestamp

High-scrutiny domain:
- Donor eligibility flag changes

### Data retention
- Donor records: 10 years after last donation
- Request/transfusion event logs: minimum 30 years or local legal requirement, whichever is longer

## 9. Data Quality and Validation Rules
### Commonly missing data
- Current donor weight
- Last donation date

### Mandatory fields
- Dual-entry blood type confirmation
- Weight check (less than 50kg auto-reject for standard volume)
- Digital wellness declaration

### Critical hard validation
- Block donor from emergency match if last donation is less than 8 weeks
- No override except Medical Director

## 10. Integration Requirements
### Required integration targets
- One-way push from central blood bank expiry management
- Bidirectional HL7/FHIR integration with Hospital Transfusion LIS
  - LIS to platform: patient request
  - Platform to LIS: unit DIN and donor code

### Sync expectations
- Donor deferral list sync must be automatic
- Inventory sync should update within seconds

### Export requirements
- FHIR API for LIS
- PDF exports with user/time stamp
- CSV exports for analysis

## 11. UX Priorities
### Hardest current screen
- Emergency Request Initiation form
- Too many diagnostic code inputs

### Required UX improvements
1. Mobilization Command Center map replacing manual call sheet
2. One-tap donor accept/decline with preset actions
3. Color-coded, large-font expiry dashboards

### Required KPI widgets on landing
- Active Matches in Transit
- Today Inventory by blood group (On Shelf vs Critical)
- Wastage Risk (expiring within 24h)

## 12. Confirmed KPI Targets (3 to 6 Months)
- Request-to-Match:
  - Less than 3 minutes standard
  - Less than 90 seconds emergency
- Donor emergency push acceptance: greater than 60%
- Emergency fulfillment rate:
  - 100% for Level 1 emergencies
  - Any miss treated as sentinel event
- Blood wastage rate: less than 0.5% of total collections

