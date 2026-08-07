import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const dashboardSource = readFileSync(new URL('./HospitalDashboardPage.tsx', import.meta.url), 'utf8');
const appointmentsSource = readFileSync(new URL('./HospitalAppointmentsPage.tsx', import.meta.url), 'utf8');
const portalServiceSource = readFileSync(new URL('../services/hospital-portal.ts', import.meta.url), 'utf8');
const dateFilterSource = readFileSync(new URL('../utils/appointment-date-filter.ts', import.meta.url), 'utf8');

test('dashboard today appointment count uses the shared appointments summary endpoint', () => {
  assert.match(portalServiceSource, /getHospitalAppointmentSummary/);
  assert.match(portalServiceSource, /\/appointments\/summary/);
  assert.match(dashboardSource, /getHospitalAppointmentSummary\(getTodayAppointmentQuery\(\)\)/);
  assert.doesNotMatch(dashboardSource, /isToday\(item\.scheduledAt\) \|\| isToday\(item\.completedAt\)/);
});

test('today filter uses scheduled appointment date with browser local timezone metadata', () => {
  assert.match(dateFilterSource, /getLocalDateString/);
  assert.match(dateFilterSource, /timezoneOffsetMinutes: new Date\(\)\.getTimezoneOffset\(\)/);
  assert.match(portalServiceSource, /dateField: 'scheduledAt'/);
});

test('appointments page supports hard-refresh safe Today filter from dashboard navigation', () => {
  assert.match(dashboardSource, /to="\/hospital\/appointments\?dateFilter=today"/);
  assert.match(appointmentsSource, /searchParams\.get\('dateFilter'\) === 'today'/);
  assert.match(appointmentsSource, /dateFilter === 'today' \? getTodayAppointmentQuery\(\) : \{\}/);
  assert.match(appointmentsSource, /Today/);
});

test('dashboard refreshes when appointment data changes', () => {
  assert.match(dashboardSource, /socket\.on\('appointment\.updated', refreshDashboard\)/);
  assert.match(dashboardSource, /socket\.off\('appointment\.updated', refreshDashboard\)/);
  assert.match(dashboardSource, /getMsUntilNextLocalDay/);
  assert.match(dashboardSource, /scheduleLocalDayRefresh/);
});

test('today appointment business rule includes all statuses visible in the appointments module', () => {
  [
    'PENDING_CONFIRMATION',
    'CONFIRMED',
    'COMPLETED',
    'DECLINED',
    'CANCELLED',
  ].forEach((status) => {
    assert.match(dateFilterSource, new RegExp(status));
    assert.match(appointmentsSource, new RegExp(status));
  });
  assert.match(appointmentsSource, /Included statuses:/);
});
