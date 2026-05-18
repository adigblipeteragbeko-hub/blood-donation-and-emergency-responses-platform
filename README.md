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
- `Role`: `SUPER_ADMIN`, `ADMIN`, `HOSPITAL_ADMIN`, `DONOR`, `HOSPITAL_STAFF`, `INVENTORY_OFFICER`, `DONOR_REVIEW_OFFICER`, `WEBSITE_CONTENT_ADMIN`, `AUDITOR`
- `RequestStatus`, `RequestProgressStatus`
- `DonorResponseStatus`
- `AppointmentStatus`

## Live Map Tracking
The platform includes a protected emergency map for hospital operations:

- Donors can update their own live location from `/donor/live-location`.
- Admins can view the secure operations map at `/admin/live-map`.
- Authorized hospital staff can view the secure operations map at `/hospital/live-map`.
- The public website never exposes donor coordinates.
- Location updates and map access are written to `AuditLog`.
- Realtime updates are emitted through the existing `/realtime` WebSocket namespace with `donor.location.updated`.
- Map rendering uses Leaflet + OpenStreetMap in the React frontend.

Backend map APIs:

- `PATCH /maps/donor/location` updates the signed-in donor's own latitude and longitude.
- `GET /maps/operations` returns hospitals, active emergency requests, and authorized donor markers.
- `GET /maps/nearby-donors?bloodGroup=O_NEG&latitude=5.6698&longitude=-0.0166&radiusKm=50` finds eligible compatible donors inside the selected radius.
- `GET /public/maps/blood-banks` returns public-safe hospital, blood bank, inventory, and active emergency request map data.
- `GET /public/maps/blood-banks?bloodGroup=O_NEG&latitude=5.6698&longitude=-0.0166&radiusKm=20` filters nearby centers that currently publish O- units.
- `GET /public/maps/nearest-blood-source?bloodGroup=O_NEG&latitude=5.6698&longitude=-0.0166&radiusKm=20` returns the nearest matching blood source.

Local setup:

```powershell
cd backend
npm.cmd install
npx.cmd prisma generate
npx.cmd prisma migrate dev
npm.cmd run start:dev
```

Open a second terminal:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev -- --port 5173
```

Geolocation notes:

- Browser geolocation works on `localhost` during development.
- Production deployments should use HTTPS.
- Phone-to-PC testing must use the PC LAN IP in the frontend API base URL, with backend listening on `0.0.0.0:4000`.

Phone/LAN setup:

1. Find the PC Wi-Fi IPv4 address with `ipconfig`.
2. Set `frontend/.env` to `VITE_API_BASE_URL=http://<PC-LAN-IP>:4000`.
3. Restart Vite after changing the env file.
4. Make sure Windows Firewall allows Node/NestJS on port `4000`.

Frontend map routes:

- `/nearby-centers` is the public Smart Blood Bank Locator. It shows public hospitals, blood banks, donation centers, emergency request markers, distance, and inventory availability without exposing donor live locations.
- `/admin/live-map` for admin operations users.
- `/hospital/live-map` for authorized hospital staff.
- `/donor/live-location` for donors to share their current location.

Smart Blood Bank Locator setup:

1. Make sure PostgreSQL is running and backend migrations are applied.
2. Open `http://localhost:5173/nearby-centers`.
3. Click `Use My Location` to calculate distances and nearest blood source.
4. Use the blood group and radius filters to find available stock during emergency demonstrations.
5. Public users only see hospital/blood-bank locations and stock summaries; donor live coordinates remain protected behind `/maps/operations`.
6. If demo hospital data is needed for a presentation, run the seed script only after explicitly deciding to load demo data into that database.

Required frontend packages:

- `leaflet`
- `react-leaflet`
- `@types/leaflet`

PowerShell smoke test:

```powershell
$adminLogin = Invoke-RestMethod -Method Post -Uri http://localhost:4000/auth/login `
  -ContentType 'application/json' `
  -Body (@{ email = '<admin-email>'; password = '<admin-password>' } | ConvertTo-Json)

$adminHeaders = @{ Authorization = "Bearer $($adminLogin.data.accessToken)" }

Invoke-RestMethod -Method Get -Uri http://localhost:4000/maps/operations -Headers $adminHeaders

Invoke-RestMethod -Method Get `
  -Uri 'http://localhost:4000/maps/nearby-donors?bloodGroup=O_NEG&latitude=5.6698&longitude=-0.0166&radiusKm=50' `
  -Headers $adminHeaders

$donorLogin = Invoke-RestMethod -Method Post -Uri http://localhost:4000/auth/login `
  -ContentType 'application/json' `
  -Body (@{ email = '<donor-email>'; password = '<donor-password>' } | ConvertTo-Json)

$donorHeaders = @{ Authorization = "Bearer $($donorLogin.data.accessToken)" }

Invoke-RestMethod -Method Patch -Uri http://localhost:4000/maps/donor/location `
  -Headers $donorHeaders `
  -ContentType 'application/json' `
  -Body (@{ latitude = 5.6501; longitude = -0.0202; accuracyMeters = 12; source = 'manual_test' } | ConvertTo-Json)
```

Expected behavior:

- Admin and authorized hospital staff can open `/maps/operations`.
- Donors can only update their own location.
- Donors receive `403 Forbidden` if they try to access `/maps/operations`.
- Public website routes do not expose donor live coordinates.
- Successful map access and donor location updates create `AuditLog` records with module `MAP_TRACKING`.

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
- Login:
  - `/login` is the single role-aware login page.
  - Legacy role login links redirect into the same protected session flow.
- Role redirects after login:
  - `DONOR` -> `/donor/dashboard`
  - `HOSPITAL`, `HOSPITAL_ADMIN`, `HOSPITAL_STAFF`, `INVENTORY_OFFICER`, `DONOR_REVIEW_OFFICER` -> `/hospital/dashboard`
  - `ADMIN`, `SUPER_ADMIN`, `WEBSITE_CONTENT_ADMIN`, `AUDITOR` -> `/admin/dashboard`

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

## Optional Seed Data Verification Notes

Important: do not run the seed script against a database that contains real/project data unless you intentionally want demo records added.

The seed script can insert/update representative records for:
- admin, donor, hospital users
- donor + hospital profiles with geolocation
- Ghana partner hospitals and donation centers
- emergency blood request
- request tracking update
- donor response
- inventory + inventory log
- appointment
- donation history
- notifications
- audit log

Use it only for a clean demo database or when demo data has been explicitly requested.

## Optional SMS Notification Setup

SMS support is prepared for emergency requests, appointment reminders, donor approvals, donation confirmations, and general system messages. Local development does not require paid SMS credentials.

Add these values to `backend/.env`:

```env
SMS_ENABLED=false
SMS_PROVIDER=console
SMS_FROM=BloodResponse
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
AFRICAS_TALKING_USERNAME=
AFRICAS_TALKING_API_KEY=
```

Local behavior:
- When `SMS_ENABLED=false`, the backend safely logs a masked phone number and skips external delivery.
- To enable a paid provider later, set `SMS_ENABLED=true`, choose `SMS_PROVIDER=twilio` or `SMS_PROVIDER=africas_talking`, then add the provider credentials.
- The application can run normally without SMS credentials.

## Donation Receipt Readiness

The current `Donation` records already store donor, hospital, blood group, donation date, and related request data. A downloadable receipt feature should be implemented as a separate safe migration so it can add receipt numbers, verification status, and optional QR verification without disturbing the stabilized donation flow.

## Additional Docs
- Security hardening: [docs/SECURITY.md](docs/SECURITY.md)
- Rollback strategy: [docs/ROLLBACK.md](docs/ROLLBACK.md)
- Route map: [docs/ROUTE_MAP.md](docs/ROUTE_MAP.md)
- ERD notes for defense: [docs/ERD_NOTES.md](docs/ERD_NOTES.md)
