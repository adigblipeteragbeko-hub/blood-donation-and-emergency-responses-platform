import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const dashboardSource = readFileSync(new URL('./HospitalDashboardPage.tsx', import.meta.url), 'utf8');
const stockIntelligenceSource = readFileSync(new URL('./HospitalStockIntelligencePage.tsx', import.meta.url), 'utf8');
const donorSearchSource = readFileSync(new URL('./HospitalDonorSearchPage.tsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const hospitalLayoutSource = readFileSync(new URL('../layouts/HospitalPortalLayout.tsx', import.meta.url), 'utf8');
const donorLayoutSource = readFileSync(new URL('../layouts/DonorPortalLayout.tsx', import.meta.url), 'utf8');

test('stock intelligence is a hospital admin route and sidebar item only', () => {
  assert.match(appSource, /HospitalStockIntelligencePage/);
  assert.match(appSource, /path="stock-intelligence"/);
  assert.match(hospitalLayoutSource, /\/hospital\/stock-intelligence/);
  assert.match(hospitalLayoutSource, /label: 'Stock Intelligence'/);
  assert.match(hospitalLayoutSource, /roles: \['HOSPITAL_ADMIN'\]/);
  assert.doesNotMatch(donorLayoutSource, /Stock Intelligence/);
});

test('hospital portal routes are outside the public MainLayout footer shell', () => {
  const mainLayoutBlock = appSource.slice(appSource.indexOf('<Route element={<MainLayout />}'), appSource.lastIndexOf('<Route path="*"'));
  assert.doesNotMatch(mainLayoutBlock, /path="\/hospital"/);
  assert.match(appSource, /<Route element=\{<ProtectedRoute roles=\{HOSPITAL_PORTAL_ROLES\} \/>\}>[\s\S]*path="\/hospital"/);
});

test('stock intelligence page exposes filters, section navigation, and controlled historical empty state', () => {
  [
    'Stock Intelligence',
    'Detailed inventory risks, early warnings, blood-group analysis, priorities, and historical stock trends',
    'Stock intelligence supports operational decision-making',
    'All Blood Groups',
    'All Levels',
    'Refresh Intelligence',
    '#risk-alerts',
    '#early-warnings',
    '#historical-trends',
    'No inventory trend history is available yet',
  ].forEach((text) => assert.match(stockIntelligenceSource, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
});

test('preview donors navigates to the hospital donor search route', () => {
  assert.match(stockIntelligenceSource, /buildEarlyWarningDonorSearchPath/);
  assert.match(stockIntelligenceSource, /\/hospital\/donor-search/);
  assert.match(stockIntelligenceSource, /Preview Donors/);
  assert.match(stockIntelligenceSource, /to=\{buildEarlyWarningDonorSearchPath\(item\.bloodGroup\)\}/);
});

test('preview donors passes blood group and compatible early-warning filters', () => {
  ['bloodGroup', "compatible: 'true'", "available: 'true'", "eligible: 'true'", "source: 'early-warning'"].forEach((text) =>
    assert.match(stockIntelligenceSource, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))),
  );
  assert.match(stockIntelligenceSource, /DEFAULT_EMERGENCY_SEARCH_RADIUS_KM/);
  assert.match(donorSearchSource, /searchParams\.get\('compatible'\) === 'true' \? 'COMPATIBLE' : 'EXACT'/);
  assert.match(donorSearchSource, /setAvailabilityFilter\('AVAILABLE_ONLY'\)/);
  assert.match(donorSearchSource, /setRadiusKm\(queryRadiusKm\)/);
});

test('early-warning donor search preview does not send notifications', () => {
  const routeBuilder = stockIntelligenceSource.slice(
    stockIntelligenceSource.indexOf('const buildEarlyWarningDonorSearchPath'),
    stockIntelligenceSource.indexOf('const buildWarningCampaignMessage'),
  );
  assert.doesNotMatch(routeBuilder, /notify: '1'/);
  assert.doesNotMatch(routeBuilder, /notify=1/);
  assert.match(donorSearchSource, /This preview does not send notifications/);
});

test('launch campaign opens a real confirmation modal with prefilled warning data', () => {
  [
    'openWarningCampaign',
    'Donor Mobilization Campaign',
    'Launch campaign for',
    'Current units',
    'Usable units',
    'Stock status',
    'Forecasted available',
    'Mobilizable donors',
    'Recommended action',
    'Campaign message',
    'Urgent blood donation appeal',
  ].forEach((text) => assert.match(stockIntelligenceSource, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
});

test('campaign submission calls the backend and prevents duplicate submissions', () => {
  assert.match(stockIntelligenceSource, /mobilizeCompatibleDonors\(\{/);
  assert.match(stockIntelligenceSource, /if \(!warningCampaign \|\| warningCampaignSending\) return/);
  assert.match(stockIntelligenceSource, /No Mobilizable Donors/);
  assert.match(stockIntelligenceSource, /compatibleAvailableDonors \?\? warningCampaign\.eligibleDonorCount/);
  assert.match(stockIntelligenceSource, /window\.confirm/);
});

test('stock intelligence uses defense-safe labels and realtime mobilization response refresh', () => {
  assert.match(stockIntelligenceSource, /donor\.mobilization\.response\.updated/);
  assert.match(stockIntelligenceSource, /formatBloodGroup\(item\.bloodGroup\)/);
  assert.match(stockIntelligenceSource, /formatBloodGroup\(campaign\.bloodGroup\)/);
  assert.match(stockIntelligenceSource, /formatBloodGroup\(response\.donor\.bloodGroup\)/);
  assert.match(stockIntelligenceSource, /getWarningLevelLabel\(item\.level\)/);
  assert.match(stockIntelligenceSource, /formatStatusLabel\(response\.responseStatus\)/);
  assert.match(stockIntelligenceSource, /Mobilizable Donors/);
  assert.match(stockIntelligenceSource, /Forecasted Available/);
});

test('campaign modal renders success and failure states', () => {
  assert.match(stockIntelligenceSource, /warningCampaignError/);
  assert.match(stockIntelligenceSource, /Unable to launch donor mobilization campaign right now/);
  assert.match(stockIntelligenceSource, /Campaign launched/);
  assert.match(stockIntelligenceSource, /compatible donor\(s\) targeted/);
});

test('dashboard keeps only a compact urgent stock preview and links to stock intelligence', () => {
  assert.match(dashboardSource, /Urgent Stock Attention/);
  assert.match(dashboardSource, /urgentStockItems[\s\S]*slice\(0, 3\)/);
  assert.match(dashboardSource, /\/hospital\/stock-intelligence\?tab=early-warnings&bloodGroup=/);
  assert.doesNotMatch(dashboardSource, /<h2 className="text-lg font-bold text-primary">Blood Stock Early Warning<\/h2>/);
  assert.doesNotMatch(dashboardSource, /<h2 className="text-lg font-bold text-primary">Current Operational Priorities<\/h2>/);
});

test('review donor action deep-links, expands, scrolls, focuses, and highlights the blood group', () => {
  assert.match(stockIntelligenceSource, /focus=donor-action/);
  assert.match(stockIntelligenceSource, /id=\{`early-warning-\$\{item\.bloodGroup\}`\}/);
  assert.match(stockIntelligenceSource, /setExpandedWarnings/);
  assert.match(stockIntelligenceSource, /scrollIntoView\(\{ behavior: 'smooth', block: 'center' \}\)/);
  assert.match(stockIntelligenceSource, /target\.focus\(\{ preventScroll: true \}\)/);
  assert.match(stockIntelligenceSource, /highlightedBloodGroup/);
});

test('stock risk reason uses plain wording while preserving numeric transparency', () => {
  assert.match(stockIntelligenceSource, /Stock is below the critical threshold/);
  assert.match(stockIntelligenceSource, /Stock-level risk:/);
  assert.match(stockIntelligenceSource, /What does the stock-risk score mean/);
  assert.match(dashboardSource, /formatRiskReason/);
});

test('donor map uses hover tooltip and click-selected panel rather than permanent donor popups', () => {
  assert.match(donorSearchSource, /Tooltip direction="top"/);
  assert.match(donorSearchSource, /offset=\{\[0, -12\]\}/);
  assert.match(donorSearchSource, /setSelectedMapDonor\(donor\)/);
  assert.match(donorSearchSource, /selectedMapDonor/);
  assert.doesNotMatch(donorSearchSource, /openPopup\(/);
});
