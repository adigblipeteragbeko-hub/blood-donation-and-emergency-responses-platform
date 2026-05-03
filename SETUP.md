# Local Setup Guide (Team)

This guide is for teammates cloning this project on a new machine.

## 1) Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL 14+

## 2) Clone and install

```bash
git clone https://github.com/adigblipeteragbeko-hub/blood-donation-and-emergency-responses-platform.git
cd blood-donation-and-emergency-responses-platform
```

Install dependencies:

```bash
cd backend && npm install
cd ../frontend && npm install
```

## 3) Environment variables

Create `backend/.env`:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/blood_platform?schema=public"

JWT_ACCESS_SECRET="change_me_access_secret"
JWT_REFRESH_SECRET="change_me_refresh_secret"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

APP_PORT=4000
FRONTEND_URL="http://localhost:5173"
BCRYPT_ROUNDS=10
```

Create `frontend/.env`:

```env
VITE_API_BASE_URL="http://localhost:4000"
```

## 4) Database setup (safe path)

Create database in PostgreSQL:

- DB name: `blood_platform`

Then run:

```bash
cd backend
npm run prisma:generate
npx prisma db push
npm run prisma:seed
```

Why `db push`:
- This avoids Prisma drift reset prompts on dev machines and preserves existing local data.

## 5) Start services

Backend:

```bash
cd backend
npm run start:dev
```

Frontend (public/donor/hospital app):

```bash
cd frontend
npm run dev -- --port 5173
```

Admin frontend (if running separately):

```bash
cd frontend
npm run dev -- --port 5174
```

## 6) Common Windows fixes

If Prisma generate fails with engine lock (`query_engine-windows.dll.node`):

1. Stop all backend/node terminals.
2. Close any process using backend files.
3. Re-run:

```bash
cd backend
npm run prisma:generate
```

## 7) Team workflow notes

- Never commit `.env` files.
- Share secrets privately (WhatsApp, 1Password, etc.).
- Commit code and schema changes only.
- If schema changes, teammates should run:

```bash
cd backend
npm run prisma:generate
npx prisma db push
```

