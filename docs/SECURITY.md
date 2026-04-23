# Security Notes

## Implemented Controls
- JWT access + refresh token authentication with refresh token hashing and revocation flow.
- Role-based authorization via `@Roles(...)` + `RolesGuard`.
- Admin routes protected in backend controllers and not exposed as public-navigation links.
- Failed admin access attempt security alert logging (`FAILED_ADMIN_ROUTE_ACCESS`).
- Global input validation using `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`).
- Global string sanitization via `StringSanitizationPipe`.
- Password hashing with Argon2.
- Forgot/reset password flow using one-time hashed tokens + expiry.
- Email verification flow using expiring one-time codes.
- Helmet security headers.
- CORS allowlist from environment configuration.
- Global throttling with Nest Throttler.
- Centralized exception filter with consistent, safe error payloads.
- Structured request logging interceptor.
- Audit logging for critical actions.

## Realtime Security Notes
- WebSocket gateway enabled under `/realtime`.
- CORS is enforced at gateway level and aligned with configured origins.
- Realtime events broadcast operational state only (no secrets/password/token material).

## Sensitive Data Handling
- `.env` controls runtime secrets, credentials, and CORS origins.
- Do not commit `.env` files.
- Rotate JWT secrets and DB credentials before production.
- Configure SMTP credentials through secret-managed environment variables.

## RBAC Enforcement Model
- User role is persisted on `User.role`.
- Role is embedded in JWT payload.
- `JwtAccessGuard` validates identity.
- `RolesGuard` enforces endpoint-level role requirements.
- Non-authorized access returns `403`.

## Production Hardening Checklist
1. Move all secrets to a secret manager (Vault / AWS Secrets Manager / Azure Key Vault).
2. Add MFA for admin accounts.
3. Use Redis-backed distributed throttling for multi-instance deployments.
4. Add WAF/API gateway bot and anomaly protection.
5. Add SIEM integration for alerts/audit streams.
6. Enforce TLS everywhere and secure cookies if browser refresh tokens are introduced.
7. Add automated dependency scanning and scheduled patching.

## Observability and Alerting
- Request logging interceptor captures method/path/ip/duration.
- Alerts service supports security and critical-event channels.
- Audit logs track actor/action/entity metadata.
- Failed admin route attempts are security alerts and should be routed to incident channels.
