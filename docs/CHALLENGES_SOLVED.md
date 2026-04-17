# Challenges Solved From Reviewed Research

This document maps the challenges you identified in the reviewed papers to concrete solutions now implemented in this project.

## 1) Design and Development of a Web Platform for Blood Donation Management

- Challenge: Difficulty in quickly locating suitable donors during emergencies.
- Implemented solution: Emergency blood requests now auto-match donors by blood compatibility and location in `backend/src/modules/blood-requests/blood-requests.service.ts`.

- Challenge: Time-consuming traditional methods (calls, personal lists).
- Implemented solution: Hospitals can create requests digitally, and matching donors are notified through the notification module (`/blood-requests` + `/notifications`).

- Challenge: No centralized and updated donor database.
- Implemented solution: PostgreSQL + Prisma centralized models for users, donors, hospitals, inventory, blood requests, and appointments (`backend/prisma/schema.prisma`).

- Challenge: Delays in emergency response risking lives.
- Implemented solution: Priority-based emergency requests and immediate in-app notification dispatch to matched donors.

- Challenge: Poor real-time connectivity between donors and patients.
- Implemented solution: Unified API and role dashboards (donor, hospital, admin) with request status updates and notification feed.

## 2) Blood Donation Application

- Challenge: Blood shortage (demand higher than supply).
- Implemented solution: Inventory module + reports summary + shortage-risk analytics to identify high-risk blood groups (`/inventory`, `/reports/summary`).

- Challenge: Inefficient donation management processes.
- Implemented solution: Structured donor profile, donation history, and appointment modules replace ad hoc flow.

- Challenge: Manual systems causing errors and delays.
- Implemented solution: DTO validation, sanitization pipe, standardized API response format, and protected workflows.

- Challenge: Lack of real-time data sharing.
- Implemented solution: Shared backend APIs used by web and mobile architecture.

- Challenge: Slow communication and nearby donor discovery.
- Implemented solution: Automated compatibility + location matching and emergency notification fanout.

- Challenge: Heavy paperwork and outdated systems.
- Implemented solution: End-to-end digital registration/login/request/inventory/report flows.

## 3) Enhancing Emergency Blood Supply Chain Management

- Challenge: Blood shortages during emergencies.
- Implemented solution: Emergency request escalation and low-match critical alert (`LOW_MATCH_COVERAGE`) logging.

- Challenge: Difficulty locating nearby donors and mobilizing quickly.
- Implemented solution: Matching uses same-location first, then broadened location search to capture nearby candidates.

- Challenge: Time-critical delays in response.
- Implemented solution: Immediate donor notification creation at request time and role-based hospital/admin visibility.

- Challenge: Uncertainty in supply chain network.
- Implemented solution: Inventory tracking by hospital and blood group with reporting summaries and risk view.

- Challenge: Weak real-time tracking/communication and engagement.
- Implemented solution: Notifications module + donor availability controls + appointment workflow.

## 4) Smart System for Blood Donation and Availability Finder

- Challenge: No real-time blood availability tracking.
- Implemented solution: `InventoryItem` with per-hospital blood-group units and reporting endpoints.

- Challenge: Outdated donor registration and fragmented processes.
- Implemented solution: Modern web forms, API-first registration, and profile management modules.

- Challenge: Slow manual eligibility verification.
- Implemented solution: Eligibility status is tracked and enforced in donor matching filters.

- Challenge: No AI/intelligent support and predictive analytics.
- Implemented solution: Added practical predictive shortage analytics in reports (30-day trend + 7-day projection + risk level by blood group).

- Challenge: Weak security and scalability.
- Implemented solution: JWT auth, refresh tokens, RBAC guards, rate limiting, exception filter, logging, audit logs, indexed schema.

## 5) Rakt-Kan: Revolutionizing Blood Donation and Emergency Services

- Challenge: Outdated systems and fragmented donor info.
- Implemented solution: Centralized data model and modular API architecture.

- Challenge: Slow emergency communication and weak integration.
- Implemented solution: Integrated request + matching + notifications + status tracking in one platform.

- Challenge: Poor donor engagement and retention.
- Implemented solution: Donor-facing flows for registration, profile, availability, appointment, and history.

- Challenge: Low community awareness and preventable deaths due to shortages.
- Implemented solution: Public-facing information pages (about/how-to-donate/contact) and faster emergency matching workflow to reduce response time.

## Operational Outcome Added To This Work

- Faster emergency donor identification via compatibility + location strategy.
- Better coverage for critical shortages via operational alerts and admin visibility.
- Data-driven planning via shortage-risk and demand projection analytics.
- Safer and scalable operations with security-first backend controls.
