import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const tableSource = readFileSync(new URL('./AdminAuditLogTable.tsx', import.meta.url), 'utf8');
const dashboardSource = readFileSync(new URL('../../pages/AdminDashboardPage.tsx', import.meta.url), 'utf8');
const managementSource = readFileSync(new URL('../../pages/AdminManagementPage.tsx', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('../../services/admin-dashboard.ts', import.meta.url), 'utf8');

test('admin management audit tab uses real shared audit table and removes placeholder', () => {
  assert.match(managementSource, /AdminAuditLogTable/);
  assert.match(managementSource, /mode="full"/);
  assert.doesNotMatch(managementSource, /Audit records are tracked in backend and available for extension/);
});

test('admin dashboard links to full audit logs and uses same endpoint service', () => {
  assert.match(dashboardSource, /View All Audit Logs/);
  assert.match(dashboardSource, /\/admin\/management\?section=audit/);
  assert.match(tableSource, /getAdminAuditLogs/);
  assert.match(serviceSource, /\/admin\/dashboard\/audit-logs/);
});

test('shared audit table renders labels, filters, pagination, states, and details', () => {
  [
    'User logged in',
    'Donor mobilisation campaign launched',
    'Loading audit logs...',
    'No audit records match the selected filters.',
    'Unable to load audit logs. Please retry.',
    'Retry',
    'Previous',
    'Next',
    'View Details',
    'Metadata',
    'Old Value',
    'New Value',
  ].forEach((text) => assert.match(tableSource, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
  assert.match(tableSource, /action/);
  assert.match(tableSource, /userId/);
  assert.match(tableSource, /module/);
  assert.match(tableSource, /from/);
  assert.match(tableSource, /to/);
});

test('audit detail redacts sensitive fields', () => {
  assert.match(tableSource, /SENSITIVE_KEYS/);
  assert.match(tableSource, /password\|token\|secret/);
  assert.match(tableSource, /\[redacted\]/);
});
