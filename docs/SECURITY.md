# Security Notes

## Implemented Controls
- JWT access and refresh token authentication with refresh token storage and revocation.
- Role-based access control using `@Roles` decorator + `RolesGuard`.
- Global validation and sanitization via `ValidationPipe` and custom `StringSanitizationPipe`.
- Guard protection on protected routes (`JwtAccessGuard`, `ActiveUserGuard`, `RolesGuard`).
- Password hashing using Argon2.
- Forgot/reset password flow using one-time hashed reset tokens with expiry.
- Signup email verification flow using one-time hashed 6-digit codes with expiry and SMTP delivery.
- Helmet headers and strict CORS origin whitelist from environment variables.
- Global rate limiting via `@nestjs/throttler`.
- Centralized exception filter with safe response format.
- Structured request and security logging.
- Audit logging for sensitive admin/system actions.

## Security Alerts Design
- Repeated failed logins trigger `FAILED_LOGIN_THRESHOLD` security event.
- Emergency request creation triggers `EMERGENCY_REQUEST_CREATED` critical event.
- Email delivery failures trigger `EMAIL_DELIVERY_FAILED` critical event.
- Alerts service can be wired to email/SMS/incident tools (PagerDuty, Opsgenie, etc.).

## Hardening Recommendations Before Production
- Move secrets to a secret manager (AWS Secrets Manager / Vault).
- Replace reset token preview response with email dispatch only.
- Add Redis-backed distributed rate limiter.
- Add MFA for admin users.
- Add WAF and API gateway request anomaly protection.
