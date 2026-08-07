# ERD Notes for Defense

These notes explain the database structure for the Blood Donation and Emergency Response Platform in a defense-friendly way. They are written for presentation and supervision, not as a replacement for the Prisma schema.

## Full ERD Notes

### Identity and Access

- `User` is the central account table. It stores login identity, role, account status, and verification state.
- `Donor` extends `User` for donor-specific details such as blood group, eligibility, availability, emergency contact, and location.
- `Hospital` stores partner hospital information, operational contact data, location, and verification status.
- `StaffProfile` connects hospital staff accounts to a hospital and department where hospital-level staff workflows are used.
- `HospitalDepartment` groups staff by operational department such as blood bank, emergency unit, records, or administration.
- `RefreshToken`, `PasswordResetToken`, and `EmailVerificationToken` support secure authentication, password reset, and account verification.

### Blood Request Workflow

- `BloodRequest` stores each blood need created by a hospital, including blood group, units needed, urgency, location, status, and needed-by date.
- `BloodRequestUpdate` stores the timeline for a request. Every status change creates a history record, so the system can show progress from creation to completion.
- `DonorResponse` records donor responses to emergency requests, including pending, accepted, declined, or donated outcomes.

### Inventory and Traceability

- `InventoryItem` stores the current stock level for each blood group at a hospital.
- `InventoryLog` records every inventory movement such as added, used, expired, or adjusted blood units.
- This design allows the current stock to remain fast to read while preserving a full history of why stock changed.

### Donation and Appointments

- `Appointment` stores donor booking and hospital scheduling information.
- `Donation` stores completed donations and links a donor, hospital, and optionally a related blood request.
- Donation history becomes the donor's permanent record and supports reporting.

### Notifications, Auditing, and Security

- `Notification` stores in-app messages, reminders, emergency alerts, and inventory alerts.
- `AuditLog` stores critical user and admin actions such as approvals, inventory changes, role changes, and location access.
- `SecurityEvent` and session-related records support login monitoring and suspicious activity review where enabled.

### Website Content Management

- `WebsiteAlert` stores editable public emergency alert banners.
- `WebsiteStatistic` stores homepage statistic overrides while still allowing real database counts.
- `FAQ`, `Testimonial`, `AwarenessPost`, `PartnerHospital`, and `WebsiteFooterSettings` allow admins to manage public website content safely without editing frontend code.
- `WebsiteAnnouncement` stores announcement feed items displayed through the public announcement system.

### Map and Location Support

- Donors, hospitals, and blood requests include latitude and longitude fields.
- Location APIs use these coordinates to find nearby eligible donors by blood group and radius.
- Donor live locations are protected and are only available to authorized admin and hospital users.

## Simplified Defense ERD

Use this simplified structure when explaining the project quickly:

```txt
User
  -> Donor
  -> Hospital Admin / Admin roles

Hospital
  -> BloodRequest
      -> BloodRequestUpdate
      -> DonorResponse
      -> Appointment
      -> Donation

Hospital
  -> InventoryItem
      -> InventoryLog

Donor
  -> Appointment
  -> Donation
  -> DonorResponse
  -> Notification

Website CMS
  -> WebsiteAlert
  -> WebsiteStatistic
  -> FAQ
  -> Testimonial
  -> AwarenessPost
  -> PartnerHospital
  -> WebsiteFooterSettings

AuditLog
  -> tracks important actions across users, requests, inventory, website content, and security events
```

## Main Relationships

- One user can be linked to one donor profile.
- One hospital can create many blood requests.
- One blood request can have many status updates.
- One blood request can receive many donor responses.
- One hospital can have many inventory records.
- One inventory record can have many inventory logs.
- One donor can have many appointments and donation history records.
- One user can receive many notifications.
- One admin or staff action can create an audit log entry.

## Normalization Notes

- First Normal Form: tables store atomic values such as one email, one blood group, and one status per record.
- Second Normal Form: workflow history is separated from the main request and inventory tables so repeated status changes are not stored as duplicate columns.
- Third Normal Form: donor details, hospital details, inventory, requests, notifications, and website content are separated by responsibility to reduce duplication and make updates safer.

## Defense Explanation

The database is designed around traceability. The main tables store the current state of operations, while log and update tables store the history behind each change. This is important for a hospital system because staff must know not only what the current status is, but also who changed it, when it changed, and why it changed.

