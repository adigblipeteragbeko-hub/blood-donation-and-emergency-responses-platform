# Rollback Strategy

## Database Migrations
- Use additive migrations first (new nullable columns, backfill, then enforce constraints).
- Create backup snapshots before major schema migrations.
- Test migrations in staging using production-like data volume.
- If migration fails, stop deployment and restore from backup snapshot.

## Application Deployment Rollback
- Use blue/green or canary deployments for backend and frontend.
- Keep last known-good image tags available.
- Rollback plan:
  1. Route traffic back to previous stable release.
  2. Verify core endpoints (`/auth/login`, `/blood-requests`, `/reports/summary`).
  3. Run smoke tests and incident review.

## Feature Flags
- Place high-risk modules (new matching algorithm, emergency broadcasts) behind feature flags.
- Default to disabled in production until validation is complete.

## Operational Checklist
- Confirm backups completed.
- Confirm migration script reviewed.
- Confirm incident channel subscriptions for alerts.
- Confirm rollback owner and runbook on-call.
