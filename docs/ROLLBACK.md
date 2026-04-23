# Rollback Strategy

## Deployment Model Assumptions
- Backend and frontend are versioned and deployed independently.
- Database uses Prisma migrations.
- Containers or release artifacts are tagged with immutable versions.

## Safe Migration Strategy
1. Prefer additive DB changes first:
   - add nullable columns/tables
   - backfill data
   - enforce constraints in follow-up migration
2. Run migrations in staging with production-like volume before production.
3. Snapshot/backup DB immediately before production migration.

## Migration Rollback Guidance
- Prisma migrate is forward-focused; rollback should use:
  1. restore from pre-migration backup for severe schema/data corruption
  2. or deploy corrective migration for non-destructive issues
- Keep SQL migration artifacts in version control for auditability.

## Application Rollback Steps
1. Stop traffic to failing release (or drain via load balancer).
2. Route traffic back to last known good backend/frontend artifacts.
3. Verify critical endpoints:
   - `/auth/login`
   - `/blood-requests`
   - `/inventory`
   - `/reports/summary`
4. Validate DB connectivity and key business workflows.
5. Monitor logs, alerts, and error rates for stabilization.

## Data Protection Checklist
- Daily automated backups + point-in-time recovery enabled.
- Backup restore drill tested periodically.
- Backup retention policy documented and enforced.
- Encryption at rest and in transit verified.

## Incident Ownership
- Assign rollback owner before release window.
- Keep on-call list and escalation path documented.
- Capture incident timeline and postmortem actions after rollback.

## Release Gates (Pre-Deploy)
1. Backend build success.
2. Frontend build success.
3. Migration scripts reviewed.
4. Security checks reviewed.
5. Rollback plan acknowledged by release owner.
