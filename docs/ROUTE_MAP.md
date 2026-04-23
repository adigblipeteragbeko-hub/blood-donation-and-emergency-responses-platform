# Final Route Map

## Frontend Routes

### Public
- `/`
- `/about`
- `/contact`
- `/request`
- `/how-to-donate`
- `/register`
- `/verify-email`

### Auth
- `/login` (donor + hospital entry)
- `/admin/login` (admin-only entry, hidden from public navigation)
- Backward-compatible aliases:
  - `/donor-login`
  - `/hospital-login`
  - `/admin-login` -> redirects to `/admin/login`

### Donor Area (Protected, `DONOR`)
- `/dashboard/donor` -> redirects to `/donor/dashboard`
- `/donor/dashboard`
- `/donor/profile`
- `/donor/eligibility`
- `/donor/history`
- `/donor/appointments`
- `/donor/emergency-requests`
- `/donor/notifications`
- `/donor/availability`
- `/donor/nearby-centers`
- `/donor/rewards`
- `/donor/health-form`
- `/donor/settings`
- `/donor/support`

### Hospital Area (Protected, `HOSPITAL_STAFF`)
- `/dashboard/hospital` -> redirects to `/hospital/dashboard`
- `/hospital/dashboard`
- `/hospital/inventory`
- `/hospital/request-blood`
- `/hospital/active-requests`
- `/hospital/donor-search`
- `/hospital/emergency-requests`
- `/hospital/appointments`
- `/hospital/notifications`
- `/hospital/reports`
- `/hospital/profile`
- `/hospital/settings`
- `/hospital/staff`
- `/hospital/support`

### Admin Area (Protected, `ADMIN`)
- `/admin/dashboard`
- `/admin/management`

## Backend API Routes

### Health
- `GET /health`

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/verify-email`
- `POST /auth/resend-verification`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /auth/change-password`
- `POST /auth/me`

### Users (Admin)
- `GET /users`
- `POST /users`
- `PATCH /users/:id`
- `DELETE /users/:id`

### Donors
- `POST /donors/profile`
- `GET /donors/profile`
- `POST /donors/donations`
- `GET /donors/admin` (admin)
- `POST /donors/admin` (admin)
- `PATCH /donors/admin/:id` (admin)
- `DELETE /donors/admin/:id` (admin)

### Hospitals
- `POST /hospitals/profile`
- `GET /hospitals/profile`
- `GET /hospitals/donor-search`
- `GET /hospitals/admin` (admin)
- `POST /hospitals/admin` (admin)
- `PATCH /hospitals/admin/:id` (admin)
- `DELETE /hospitals/admin/:id` (admin)

### Blood Requests
- `POST /blood-requests`
- `GET /blood-requests`
- `GET /blood-requests/mine`
- `GET /blood-requests/:id`
- `PATCH /blood-requests/:id/status`
- `GET /blood-requests/:id/updates`
- `POST /blood-requests/:id/updates`
- `GET /blood-requests/:id/donor-responses`
- `POST /blood-requests/:id/respond`

### Donor Responses
- `PATCH /donor-responses/:id`

### Inventory
- `POST /inventory`
- `GET /inventory`
- `PATCH /inventory/:id`
- `GET /inventory/logs`
- `POST /inventory/:id/logs`

### Appointments
- `POST /appointments`
- `POST /appointments/hospital`
- `GET /appointments`
- `PATCH /appointments/:id/status`

### Notifications
- `GET /notifications`
- `PATCH /notifications/delivery`

### Reports
- `GET /reports/summary`

## WebSocket (Realtime)

Namespace:
- `/realtime`

Events:
- `emergency.request.updated`
- `donor.response.updated`
- `inventory.updated`
- `notification.created`
