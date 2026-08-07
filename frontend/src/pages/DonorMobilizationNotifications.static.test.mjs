import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const dashboardSource = readFileSync(new URL('./DonorDashboardPage.tsx', import.meta.url), 'utf8');
const notificationsSource = readFileSync(new URL('./NotificationsPage.tsx', import.meta.url), 'utf8');
const hospitalDashboardSource = readFileSync(new URL('./HospitalDashboardPage.tsx', import.meta.url), 'utf8');

test('donor dashboard displays mobilization notifications as open alerts and recent activity', () => {
  assert.match(dashboardSource, /isMobilizationNotification/);
  assert.match(dashboardSource, /PROACTIVE_DONATION/);
  assert.match(dashboardSource, /Boolean\(item\.campaignId\)/);
  assert.match(dashboardSource, /isOpenAlert/);
  assert.match(dashboardSource, /Emergency Donation Appeal/);
  assert.match(dashboardSource, /Emergency donor mobilization alert received/);
});

test('donor dashboard refreshes safely from notification socket events', () => {
  assert.match(dashboardSource, /createRealtimeSocket/);
  assert.match(dashboardSource, /notification\.created/);
  assert.match(dashboardSource, /window\.setTimeout/);
  assert.match(dashboardSource, /Array\.from\(new Set\(next\)\)/);
  assert.match(dashboardSource, /socket\.off\('notification\.created'/);
});

test('notifications page supports mobilization and unknown notification types', () => {
  assert.match(notificationsSource, /isProactiveDonation/);
  assert.match(notificationsSource, /notificationLabel/);
  assert.match(notificationsSource, /Emergency Donation Appeal/);
  assert.match(notificationsSource, /item\.type\.replace/);
  assert.match(notificationsSource, /createRealtimeSocket/);
});

test('hospital recent activity includes campaign summary notifications', () => {
  assert.match(hospitalDashboardSource, /campaignNotificationActivity/);
  assert.match(hospitalDashboardSource, /item\.campaignId/);
  assert.match(hospitalDashboardSource, /mobilisation\|mobilization\|campaign/);
});
