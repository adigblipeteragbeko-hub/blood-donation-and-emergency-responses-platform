import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Admin dashboard audit logs', () => {
  const controllerSource = readFileSync(join(__dirname, 'admin-dashboard.controller.ts'), 'utf8');
  const serviceSource = readFileSync(join(__dirname, 'admin-dashboard.service.ts'), 'utf8');

  it('keeps the audit endpoint protected for admin roles and audit permissions', () => {
    expect(controllerSource).toContain("@Controller('admin/dashboard')");
    expect(controllerSource).toContain("@Get('audit-logs')");
    expect(controllerSource).toContain('@Roles(Role.ADMIN');
    expect(controllerSource).toContain('PermissionCode.AUDIT_LOG_VIEW');
  });

  it('returns newest audit records with actor details, filters, and actor filter users', () => {
    expect(serviceSource).toContain('async getAuditLogs');
    expect(serviceSource).toContain("orderBy: { createdAt: 'desc' }");
    expect(serviceSource).toContain('include: { actor: { select: { id: true, email: true, role: true } } }');
    expect(serviceSource).toContain('query.action');
    expect(serviceSource).toContain('query.userId');
    expect(serviceSource).toContain('query.module');
    expect(serviceSource).toContain('query.from');
    expect(serviceSource).toContain('query.to');
    expect(serviceSource).toContain('where: { auditLogs: { some: {} } }');
  });
});
