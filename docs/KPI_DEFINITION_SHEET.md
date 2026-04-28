# KPI Definition Sheet

## Purpose
Define KPI formulas, targets, data sources, and owners for hospital donor emergency operations.

## KPI 1: Request-to-Match Time
- Definition: Time from request creation to first compatible donor match event.
- Formula: `first_match_timestamp - request_created_timestamp`
- Segments:
  - Standard
  - Emergency Level 1
- Target:
  - Standard: less than 3 minutes
  - Emergency: less than 90 seconds
- Data Sources:
  - blood_requests.created_at
  - blood_request_updates (status transitions)
- Owner: Blood Bank Operations Lead
- Alert:
  - Trigger if median exceeds target for rolling 24h

## KPI 2: Donor Response Acceptance Rate (Emergency Push)
- Definition: Percentage of emergency push notifications that receive accepted response.
- Formula: `(accepted_responses / emergency_push_notifications_sent) * 100`
- Target: greater than 60%
- Time Window: Daily and weekly
- Data Sources:
  - notifications
  - donor_responses
- Owner: Donor Mobilization Supervisor
- Alert:
  - Trigger if below target for 2 consecutive days

## KPI 3: Emergency Fulfillment Rate (Level 1)
- Definition: Percentage of Level 1 emergency requests completed as transfused.
- Formula: `(level1_transfused_completed / level1_total_requests) * 100`
- Target: 100%
- Policy:
  - Any miss is sentinel event
- Data Sources:
  - blood_requests (priority, status)
  - blood_request_updates
  - transfusion completion fields (encounter, nurse, DIN)
- Owner: Senior Administrator + Medical Director
- Alert:
  - Immediate escalation on any non-fulfilled Level 1 request

## KPI 4: Blood Wastage Rate
- Definition: Percentage of collected units discarded due to expiry/wastage.
- Formula: `(wasted_units / total_collected_units) * 100`
- Target: less than 0.5%
- Time Window: Monthly
- Data Sources:
  - inventory_logs
  - donation_history
  - expiry events
- Owner: Inventory and Quality Lead
- Alert:
  - Trigger if projected month-end rate exceeds 0.5%

## KPI 5: Active Matches in Transit
- Definition: Current count of donor-confirmed en-route matches not yet collected/transfused.
- Formula: Count of requests in `Donor Confirmed (En Route)` state
- Target: Informational operational load metric
- Data Sources:
  - blood_requests
  - blood_request_updates
- Owner: Shift Supervisor
- Display: Primary command center widget

## KPI 6: Inventory On Shelf vs Critical
- Definition: Current unit counts by ABO/Rh compared to critical thresholds.
- Formula: `current_units_by_group` vs configured threshold table
- Critical Threshold Baseline:
  - O-neg critical less than 12, standard less than 20
  - B-neg and AB-neg critical less than 5
  - Platelets critical less than 3
- Data Sources:
  - inventory
  - threshold configuration
- Owner: Inventory Controller
- Alert:
  - Real-time when threshold crossed

## KPI 7: Wastage Risk (24h)
- Definition: Units expiring within 24 hours and not already allocated.
- Formula: Count of available units where `expires_at <= now + 24h`
- Target: Operational reduction trend
- Data Sources:
  - inventory units and expiry metadata
- Owner: Expiry Management Coordinator
- Alert:
  - Real-time risk widget and escalation to inventory team

---

## Data Quality Requirements for KPI Validity
- Mandatory timestamp integrity for all status transitions
- Immutable audit log linkage for key events
- Required legal completion fields on transfused events:
  - Encounter ID
  - Transfusing nurse ID
  - Unit DIN

## Reporting Cadence
- Real-time dashboard: KPIs 1, 5, 6, 7
- Weekly committee report: KPI 1, 2, 3
- Monthly regulatory report: KPI 2, 3, 4

## Ownership and Governance
- KPI definitions approved by Senior Administrator and Medical Director
- Any formula or threshold change requires:
  - Admin workflow update
  - Audit log entry
  - Effective date annotation

