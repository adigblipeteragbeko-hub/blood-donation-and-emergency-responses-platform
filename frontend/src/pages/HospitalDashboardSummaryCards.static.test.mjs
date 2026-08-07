import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const dashboardSource = readFileSync(new URL('./HospitalDashboardPage.tsx', import.meta.url), 'utf8');
const inventorySource = readFileSync(new URL('./HospitalInventoryPage.tsx', import.meta.url), 'utf8');
const activeRequestsSource = readFileSync(new URL('./HospitalActiveRequestsPage.tsx', import.meta.url), 'utf8');
const donorSearchSource = readFileSync(new URL('./HospitalDonorSearchPage.tsx', import.meta.url), 'utf8');
const stockIntelligenceSource = readFileSync(new URL('./HospitalStockIntelligencePage.tsx', import.meta.url), 'utf8');
const portalServiceSource = readFileSync(new URL('../services/hospital-portal.ts', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const authTypesSource = readFileSync(new URL('../types/auth.ts', import.meta.url), 'utf8');

test('all hospital dashboard summary cards are semantic links with accessible labels and focus states', () => {
  [
    'Open hospital inventory',
    'View active blood requests',
    "Open today's appointments",
    'View critical blood groups',
    'View approved available donors',
    'View blood units expiring soon',
    'SUMMARY_CARD_CLASS',
    'focus:ring-4',
    'cursor-pointer',
  ].forEach((text) => assert.match(dashboardSource, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
});

test('summary cards navigate to the intended hospital-admin destinations', () => {
  [
    'to="/hospital/inventory"',
    'to="/hospital/active-requests?filter=active"',
    'to="/hospital/appointments?dateFilter=today"',
    'to="/hospital/stock-intelligence?tab=risk-alerts&riskLevel=critical"',
    'to="/hospital/donor-search?available=true&eligible=true&approval=approved"',
    'to="/hospital/inventory?filter=expiring-soon"',
  ].forEach((text) => assert.match(dashboardSource, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
});

test('dashboard counts reuse destination-page backend sources', () => {
  assert.match(dashboardSource, /getHospitalInventory\(\)/);
  assert.match(dashboardSource, /getHospitalActiveRequestSummary\(\)/);
  assert.match(dashboardSource, /getHospitalAppointmentSummary\(getTodayAppointmentQuery\(\)\)/);
  assert.match(dashboardSource, /getBloodStockWarnings\(\)/);
  assert.match(dashboardSource, /searchHospitalDonors\(\{ availabilityFilter: 'AVAILABLE_ONLY' \}\)/);
  assert.match(portalServiceSource, /\/blood-requests\/hospital-active\/summary/);
});

test('destination URL filters are hard-refresh safe and render truthful empty states', () => {
  assert.match(inventorySource, /searchParams\.get\('filter'\) === 'expiring-soon'/);
  assert.match(inventorySource, /No usable blood units are approaching expiry within the configured warning period/);
  assert.match(activeRequestsSource, /searchParams\.get\('filter'\) === 'active'/);
  assert.match(activeRequestsSource, /There are no active blood requests/);
  assert.match(donorSearchSource, /searchParams\.get\('approval'\) === 'approved'/);
  assert.match(donorSearchSource, /No approved and available donors currently match this hospital/);
  assert.match(stockIntelligenceSource, /searchParams\.get\('riskLevel'\)\?\.toLowerCase\(\) === 'critical'/);
  assert.match(stockIntelligenceSource, /No blood groups are currently classified as critical/);
});

test('stock intelligence critical filter survives refresh and filters the risk alert list', () => {
  assert.match(stockIntelligenceSource, /riskLevelFilter/);
  assert.match(stockIntelligenceSource, /filteredRiskAlertItems/);
  assert.match(stockIntelligenceSource, /item\.level === riskLevelFilter/);
  assert.match(stockIntelligenceSource, /document\.getElementById\('risk-alerts'\)/);
});

test('donor search dashboard filter searches all approved available donors instead of defaulting to O+', () => {
  assert.match(donorSearchSource, /initialBloodGroup = .* \?\? ''/);
  assert.match(donorSearchSource, /<option value="">All Blood Groups<\/option>/);
  assert.match(donorSearchSource, /bloodGroup: bloodGroup \|\| undefined/);
  assert.match(donorSearchSource, /setAvailabilityFilter\('AVAILABLE_ONLY'\)/);
});

test('dashboard refreshes counts from related realtime events', () => {
  [
    'inventory.updated',
    'emergency.request.updated',
    'appointment.updated',
    'donor.search.invalidated',
    'donor.response.updated',
    'hospital.map.updated',
    'notification.created',
  ].forEach((event) => assert.match(dashboardSource, new RegExp(event.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
});

test('hospital routes remain protected away from donors and ordinary admin redirects', () => {
  assert.match(appSource, /ProtectedRoute roles=\{HOSPITAL_PORTAL_ROLES\}/);
  assert.match(authTypesSource, /HOSPITAL_PORTAL_ROLES: Role\[\] = \['HOSPITAL_ADMIN'\]/);
  assert.doesNotMatch(`${appSource}\n${authTypesSource}`, /HOSPITAL_STAFF|BLOOD_BANK_OFFICER|SUPER_ADMIN/);
});
