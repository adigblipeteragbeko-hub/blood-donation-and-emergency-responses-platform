import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('./AdminDashboardPage.tsx', import.meta.url), 'utf8');

test('admin dashboard normalizes partial report, security, and audit payloads before render', () => {
  assert.match(source, /function normalizeReports/);
  assert.match(source, /function normalizeSecurity/);
  assert.match(source, /function normalizeAuditLogEntry/);
  assert.match(source, /function normalizeAuditData/);
  assert.match(source, /setReports\(normalizeReports\(reportsData\)\)/);
  assert.match(source, /setSecurity\(normalizeSecurity\(securityData\)\)/);
  assert.match(source, /setAuditData\(normalizeAuditData\(auditLogsData\)\)/);
});

test('admin dashboard validates dates and missing action values safely', () => {
  assert.match(source, /Date unavailable/);
  assert.match(source, /Number\.isNaN\(date\.getTime\(\)\)/);
  assert.match(source, /function humanizeToken\(value\?: string \| null\)/);
  assert.match(source, /UNKNOWN/);
});

test('admin dashboard avoids unsafe proactive mobilization nested array access', () => {
  assert.match(source, /asArray\(reports\.proactiveMobilization\?\.atRiskHospitals\)\.length/);
  assert.match(source, /asArray\(reports\.proactiveMobilization\?\.campaigns\)\.length/);
  assert.doesNotMatch(source, /proactiveMobilization\?\.campaigns\.length/);
  assert.doesNotMatch(source, /proactiveMobilization\?\.atRiskHospitals\.length/);
});

test('admin dashboard audit records have safe display fallbacks', () => {
  assert.match(source, /UNKNOWN_ACTION/);
  assert.match(source, /UNKNOWN_ENTITY/);
  assert.match(source, /Unknown user/);
  assert.match(source, /UNKNOWN_ROLE/);
});
