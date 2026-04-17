# Blood Donation and Emergency Response Platform

## 1. Project Overview
Production-ready monorepo for a hospital blood donation and emergency response system with:
- Responsive website for donors, hospital staff, and admins.
- Mobile app architecture (React Native) using shared backend APIs.
- Secure NestJS backend with PostgreSQL + Prisma.
- Emergency request matching by blood group and location.

## 2. Tech Stack
- Frontend Web: React, TypeScript, Tailwind CSS, React Router, Axios, Vite.
- Mobile: React Native (Expo) with TypeScript.
- Backend: Node.js, NestJS, TypeScript.
- Database: PostgreSQL + Prisma ORM.
- Auth: JWT access + refresh tokens, role-based guards.
- DevOps: Docker, docker-compose, `.env` driven config.

## 3. Folder Structure
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
        sanitization/
      config/
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
    .env.example
    Dockerfile
    package.json
  frontend/
    src/
      components/
      context/
      hooks/
      layouts/
      pages/
      services/
      types/
      App.tsx
      main.tsx
    .env.example
    package.json
    tailwind.config.js
    vite.config.ts
  mobile/
    src/
      navigation/
      screens/
      services/
      types/
    .env.example
    App.tsx
    package.json
  docs/
    CHALLENGES_SOLVED.md
    MOBILE_VISION.md
    ROLLBACK.md
    SECURITY.md
  docker-compose.yml
  README.md
```

## 4. Database Schema
Implemented in `backend/prisma/schema.prisma` with these models:
- `User` (`ADMIN`, `DONOR`, `HOSPITAL_STAFF`)
- `Donor`
- `Hospital`
- `BloodRequest`
- `InventoryItem`
- `Appointment`
- `Donation`
- `Notification`
- `RefreshToken`
- `PasswordResetToken`
- `AuditLog`

Relationships include:
- User one-to-one with Donor/Hospital profile.
- Hospital one-to-many BloodRequest/Inventory/Appointment.
- Donor one-to-many Donation/Appointment.
- BloodRequest many-to-many matched Donors.

Indexes implemented:
- `email` (unique on `User.email`)
- `bloodGroup` (Donor, BloodRequest, InventoryItem)
- `location` (Donor, Hospital, BloodRequest)
- `request status` (`BloodRequest.status`)
- `appointment date` (`Appointment.scheduledAt`)
- `createdAt` across major entities

Migration scaffold included at:
- `backend/prisma/migrations/20260416130000_init/migration.sql`

Seed file:
- `backend/prisma/seed.ts`

## 5. Backend Implementation
Core backend modules:
- `AuthModule`: register, login, logout, refresh, forgot/reset/change password.
- `UsersModule`: admin user management.
- `DonorsModule`: donor profile, eligibility, availability, donation history.
- `HospitalsModule`: hospital profile management.
- `BloodRequestsModule`: request creation, emergency priority, donor matching, status updates.
- `InventoryModule`: hospital blood inventory updates and listing.
- `AppointmentsModule`: appointment booking and status updates.
- `NotificationsModule`: in-app notification feed and delivery status updates.
- `ReportsModule`: blood stock, donation activity, request, emergency summaries.

Research-challenge upgrades now included:
- Smarter emergency donor matching using blood compatibility + location strategy.
- Low match coverage critical alerts for emergency requests.
- Predictive shortage analytics (30-day demand window + 7-day projection + risk by blood group).

API route summary:
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /auth/change-password`
- `POST /auth/me`
- `GET /users`
- `PATCH /users/:id`
- `POST /donors/profile`
- `GET /donors/profile`
- `POST /donors/donations`
- `POST /hospitals/profile`
- `GET /hospitals/profile`
- `POST /blood-requests`
- `GET /blood-requests`
- `PATCH /blood-requests/:id/status`
- `POST /inventory`
- `GET /inventory`
- `POST /appointments`
- `GET /appointments`
- `PATCH /appointments/:id/status`
- `GET /notifications`
- `PATCH /notifications/delivery`
- `GET /reports/summary`

Validation and DTOs:
- DTO files are under each module `dto/` folder.
- Uses `class-validator` + `class-transformer` + global validation pipe.

Auth + Authorization:
- JWT access/refresh strategy.
- Guard-based route protection.
- Role restrictions via `@Roles(...)` and `RolesGuard`.
- Refresh token rotation with revocation.

## 6. Frontend Implementation
Website includes pages for:
- Landing
- About
- Donor login
- Hospital login
- Dashboard by role
- Emergency requests
- Blood inventory
- Appointments
- Notifications
- Profile
- Admin management
- Reports

UI direction implemented:
- White background
- Red accent (`#c1121f`)
- Dark gray text
- Large clear action buttons
- Mobile responsive layout with accessible form controls

Routing:
- Configured in `frontend/src/App.tsx` with protected routes and role checks.

API integration:
- Axios instance in `frontend/src/services/api.ts`
- Auth state context in `frontend/src/context/AuthContext.tsx`

## 7. Security Implementation
Implemented controls:
- Environment-based config (`backend/.env.example`, `frontend/.env.example`, `mobile/.env.example`).
- Global input validation and sanitization.
- Guard-based authorization checks.
- Role-based route protection.
- Secure password hashing (Argon2).
- Password reset tokens hashed with expiry.
- CORS whitelist configuration.
- Global rate limiting (`ThrottlerModule`).
- Centralized exception filter with safe error output.
- Audit logging for sensitive operations.
- Security alerts for repeated failed logins and critical emergencies.

Detailed notes:
- `docs/SECURITY.md`

## 8. Logging and Alerting
Implemented logging:
- Request logging interceptor (method/path/ip/duration).
- Exception logging through global filter.
- Security event logging through `AlertsService`.
- Audit logs persisted via `AuditService` and `AuditLog` model.

Alert design includes:
- Repeated failed logins.
- Unusual emergency spikes (extend `AlertsService` thresholds).
- Server failures from exception logs and incident pipeline hooks.

## 9. Rollback Strategy
Included practical rollback strategy in:
- `docs/ROLLBACK.md`

Highlights:
- Safe additive migrations.
- Backup before major schema changes.
- Blue/green or canary deployment rollback steps.
- Last-known-good artifact strategy.
- Feature flags for risky releases.

## 10. README Setup Guide
### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- npm 10+
- Docker (optional)

### Backend setup
```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
npm run start:dev
```

### Frontend setup
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

### Mobile setup
```bash
cd mobile
cp .env.example .env
npm install
npm run start
```

### Docker setup
```bash
docker compose up --build
```

### Production safety checklist
1. Replace all default JWT secrets and database credentials.
2. Disable password reset token preview in API response.
3. Configure real email/SMS providers.
4. Enable centralized log shipping and incident alert integrations.
5. Validate migration backups before applying schema changes.

## Mobile App Vision Structure and Screen List
See:
- `docs/MOBILE_VISION.md`
- `docs/CHALLENGES_SOLVED.md` for mapped challenge-to-solution implementation.

Current screens scaffolded:
- Donor Login/Register
- Dashboard
- Emergency Alerts
- Appointments
- Donation History
- Profile and Availability
