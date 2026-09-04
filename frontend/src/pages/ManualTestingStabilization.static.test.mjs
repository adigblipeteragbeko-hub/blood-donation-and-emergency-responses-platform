import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(join(process.cwd(), path), 'utf8');

test('clinical form validates Ghana Card format and strips UI-only answer metadata from payload', () => {
  const source = read('src/pages/DonorClinicalFormPage.tsx');

  assert.match(source, /\^GHA-\[0-9\]\{9\}-\[0-9\]\$/);
  assert.match(source, /normalizeDocumentNumber/);
  assert.match(source, /This checks format only and does not verify authenticity/);
  assert.doesNotMatch(source, /Ghana Card verified/);
  assert.match(source, /buildHealthAnswersPayload/);
  assert.match(source, /questionKey: answer\.questionKey/);
  assert.match(source, /questionText: answer\.questionText/);
  assert.match(source, /answer: answer\.answer/);
  assert.doesNotMatch(source, /healthAnswers,\n\s*\}/);
  assert.match(source, /We could not save the form because some submitted fields were invalid/);
});

test('inventory page separates stock correction from stock movement and supports all blood groups', () => {
  const source = read('src/pages/HospitalInventoryPage.tsx');
  const service = read('src/services/hospital-portal.ts');

  assert.match(source, /Current Inventory \/ Stock Adjustment/);
  assert.match(source, /Set Current Stock/);
  assert.match(source, /Adjustment Reason/);
  assert.match(source, /Record Inventory Movement/);
  assert.match(source, /confirmedBloodGroups\.map/);
  assert.match(source, /Initialised for inventory movement/);
  assert.match(service, /reason\?: string/);
});

test('donor search explains matching diagnostics and zero-result actions', () => {
  const source = read('src/pages/HospitalDonorSearchPage.tsx');
  const service = read('src/services/hospital-portal.ts');

  assert.match(source, /Matching Diagnostics/);
  assert.match(source, /Exact Match requires the donor blood group to equal the selected group/);
  assert.match(source, /Compatible Match uses the platform compatibility matrix/);
  assert.match(source, /No donors matched all current filters/);
  assert.match(service, /exclusionSummary\?: Record<string, number>/);
});

test('layout and floating controls avoid bottom overlap', () => {
  const css = read('src/index.css');
  const hospitalLayout = read('src/layouts/HospitalPortalLayout.tsx');
  const donorLayout = read('src/layouts/DonorPortalLayout.tsx');
  const adminLayout = read('src/layouts/AdminPortalLayout.tsx');
  const mainLayout = read('src/layouts/MainLayout.tsx');
  const dashboard = read('src/pages/HospitalDashboardPage.tsx');
  const stock = read('src/pages/HospitalStockIntelligencePage.tsx');

  assert.match(css, /\.page-content-safe-bottom/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  [hospitalLayout, donorLayout, adminLayout, mainLayout].forEach((source) => assert.match(source, /page-content-safe-bottom/));
  assert.match(dashboard, /bottom-\[calc\(5\.5rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(stock, /bottom-\[calc\(5\.5rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(dashboard, /aria-label="Open Emergency Actions"/);
  assert.match(stock, /aria-label="Open Emergency Actions"/);
});

test('campaign and cannot-fulfil copy uses production-safe wording', () => {
  const dashboard = read('src/pages/HospitalDashboardPage.tsx');
  const stock = read('src/pages/HospitalStockIntelligencePage.tsx');
  const activeRequests = read('src/pages/HospitalActiveRequestsPage.tsx');

  [dashboard, stock].forEach((source) => {
    assert.match(source, /SMS is attempted first/);
    assert.match(source, /It does not notify other hospitals unless an inter-hospital request is also created/);
  });
  assert.match(activeRequests, /Secure hospital messaging is not yet enabled/);
  assert.doesNotMatch(activeRequests, /placeholder until/);
  assert.match(activeRequests, /Your hospital marked this request as unable to fulfil/);
});

test('admin donor management separates account approval from clinical eligibility', () => {
  const source = read('src/pages/AdminManagementPage.tsx');

  assert.match(source, />Account Status</);
  assert.match(source, />Clinical Eligibility</);
  assert.match(source, /Approve Account/);
  assert.match(source, /Suspend Account/);
  assert.match(source, /This does NOT approve the donor for blood donation/);
  assert.match(source, /Clinical eligibility can only be approved by an authorised Hospital Administrator/);
  assert.match(source, /Account Information/);
  assert.match(source, /Clinical Information/);
  assert.match(source, /Health Form Status/);
  assert.match(source, /Clinical Eligibility Decision/);
  assert.match(source, /api\.patch\(`\/donors\/admin\/\$\{id\}\/account-status`/);
  assert.doesNotMatch(source, /api\.patch\(`\/donors\/admin\/\$\{id\}\/eligibility`/);
});

test('live emergency banner expiry is selectable and enforced in the UI', () => {
  const emergencyRequest = read('src/pages/HospitalEmergencyRequestsPage.tsx');
  const bloodRequest = read('src/pages/HospitalRequestBloodPage.tsx');
  const banner = read('src/components/LiveEmergencyAlertBanner.tsx');
  const service = read('src/services/hospital-portal.ts');

  [emergencyRequest, bloodRequest].forEach((source) => {
    assert.match(source, /Notification Expiry/);
    assert.match(source, /Custom duration/);
    assert.match(source, /emergencyNotificationDurationMinutes/);
    assert.match(source, /24 \* 60/);
  });

  assert.match(banner, /emergencyNotificationExpiresAt/);
  assert.match(banner, /Expires in/);
  assert.match(banner, /10 \* 60 \* 1000/);
  assert.match(banner, /Mark Resolved/);
  assert.match(banner, /\/blood-requests\/\$\{activeAlert\.id\}\/emergency-notification\/resolve/);
  assert.match(service, /resolveEmergencyNotification/);
});

test('public main website navbar ends at login without announcement bell', () => {
  const mainLayout = read('src/layouts/MainLayout.tsx');

  assert.match(mainLayout, /\['\/login', 'Login'\]/);
  assert.match(mainLayout, /desktopNavItems = isAuthenticated \? authNavItems : publicNavItems/);
  assert.match(mainLayout, /aria-label="Open notifications"/);
  assert.match(mainLayout, /onClick=\{openNotifications\}/);
  assert.doesNotMatch(mainLayout, /announcement-panel/);
  assert.doesNotMatch(mainLayout, /Support channels are live/);
});

test('header notification badge uses the same real notification source as the donor notifications page', () => {
  const mainLayout = read('src/layouts/MainLayout.tsx');
  const notificationsPage = read('src/pages/NotificationsPage.tsx');

  assert.match(mainLayout, /getHospitalNotifications\(\{ take: 100 \}\)/);
  assert.match(notificationsPage, /getHospitalNotifications\(\{ take: 100 \}\)/);
  assert.match(mainLayout, /headerNotifications\.filter\(\(notification\) => !notification\.delivered\)\.length/);
  assert.match(notificationsPage, /notifications\.filter\(\(item\) => !item\.delivered\)\.length/);
  assert.match(mainLayout, /unreadNotifications > 0 \? \(/);
  assert.match(notificationsPage, /window\.dispatchEvent\(new Event\('notifications:changed'\)\)/);
  assert.doesNotMatch(mainLayout, /getUserAnnouncements/);
  assert.doesNotMatch(mainLayout, /unreadAnnouncements/);
});
