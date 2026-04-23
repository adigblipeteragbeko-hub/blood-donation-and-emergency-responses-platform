# Blood Donation and Emergency Response Platform

Production-ready monorepo for a hospital-grade blood donation and emergency response system with separated public site, role-based dashboards, secure backend APIs, and realtime tracking events.

## Stack
- Frontend: React + TypeScript + Tailwind CSS + React Router + Axios
- Backend: NestJS + TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Auth: JWT access + refresh token
- Realtime: NestJS WebSocket Gateway (`/realtime`)
- Security: RBAC, CORS allowlist, validation, sanitization, throttling, centralized exception handling

## Current Folder Structure
```txt
FINAL PROJECT/
  backend/
    prisma/
      migrations/
      schema.prisma
      seed.ts
    src/
      common/
        alerts/
        audit/
        decorators/
        filters/
        guards/
        interceptors/
        mail/
        realtime/
        sanitization/
      config/
      core/
      modules/
        appointments/
        auth/
        blood-requests/
        donors/
        hospitals/
        inventory/
        notifications/
        reports/
        users/
      app.module.ts
      main.ts
      prisma.service.ts
  frontend/
    src/
      components/
      constants/
      context/
      hooks/
      layouts/
      pages/
      services/
      types/
      App.tsx
      main.tsx
  mobile/
  docs/
    SECURITY.md
    ROLLBACK.md
    ROUTE_MAP.md
```

## Prisma Schema Coverage
Implemented tracking schema in [backend/prisma/schema.prisma](backend/prisma/schema.prisma):
- `User`, `Donor`, `Hospital`
- `BloodRequest`, `BloodRequestUpdate`, `DonorResponse`
- `InventoryItem`, `InventoryLog`
- `Appointment`, `Donation`
- `Notification`, `AuditLog`
- token tables (`RefreshToken`, `PasswordResetToken`, `EmailVerificationToken`)

Enums include:
- `Role`: `ADMIN`, `DONOR`, `HOSPITAL_STAFF`
- `RequestStatus`, `RequestProgressStatus`
- `DonorResponseStatus`
- `AppointmentStatus`
- `InventoryChangeType`
- `NotificationType`

## Auth + RBAC
Implemented in `backend/src/modules/auth` and guards/decorators:
- register, login, verify email, refresh token, logout
- forgot/reset password + change password
- JWT access + refresh strategies
- `@Roles(...)` decorator + `RolesGuard`
- admin route enforcement at backend controller level
- failed admin access security alert logging

## Frontend Route Design (Spec-Aligned)
- Public pages:
  - `/`
  - `/about`
  - `/contact`
  - `/register`
- Login pages:
  - `/login` (donor + hospital only)
  - `/admin/login` (hidden from public nav)
- Role redirects after login:
  - donor -> `/dashboard/donor`
  - hospital -> `/dashboard/hospital`
  - admin -> `/admin/dashboard`

The public navigation does not expose an admin button.

## Realtime Events
Gateway namespace: `/realtime`

Broadcast channels:
- `emergency.request.updated`
- `donor.response.updated`
- `inventory.updated`
- `notification.created`

## Setup
### 1. Backend
```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
npm run start:dev
```

### 2. Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

### 3. Docker Postgres Option
```bash
cd ..
docker compose up -d postgres
```

## Build Verification
Backend:
```bash
cd backend
npm run build
```

Frontend:
```bash
cd frontend
npm run build
```

## Seed Data Verification Notes
Seed script now inserts/updates representative records for:
- admin, donor, hospital users
- donor + hospital profiles with geolocation
- emergency blood request
- request tracking update
- donor response
- inventory + inventory log
- appointment
- donation history
- notifications
- audit log

Seed script is idempotent for core records and safe to rerun.

## Additional Docs
- Security hardening: [docs/SECURITY.md](docs/SECURITY.md)
- Rollback strategy: [docs/ROLLBACK.md](docs/ROLLBACK.md)
- Route map: [docs/ROUTE_MAP.md](docs/ROUTE_MAP.md)
