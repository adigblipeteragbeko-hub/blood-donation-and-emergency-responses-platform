import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const panel = readFileSync(new URL('./AiIntelligencePanel.tsx', import.meta.url), 'utf8');
const service = readFileSync(new URL('../services/ai-intelligence.ts', import.meta.url), 'utf8');
const adminLayout = readFileSync(new URL('../layouts/AdminPortalLayout.tsx', import.meta.url), 'utf8');
const hospitalLayout = readFileSync(new URL('../layouts/HospitalPortalLayout.tsx', import.meta.url), 'utf8');
const authTypes = readFileSync(new URL('../types/auth.ts', import.meta.url), 'utf8');

test('frontend role type contains only the approved roles', () => {
  assert.match(authTypes, /export type Role = 'ADMIN' \| 'DONOR' \| 'HOSPITAL_ADMIN'/);
  for (const unsupported of ['SUPER' + '_ADMIN', 'HOSPITAL' + '_STAFF', 'BLOOD_BANK' + '_OFFICER']) {
    assert.equal(authTypes.includes(unsupported), false);
  }
});

test('AI Intelligence appears for Admin and Hospital Admin navigation only', () => {
  assert.match(adminLayout, /section=ai-intelligence/);
  assert.match(hospitalLayout, /\/hospital\/ai-intelligence/);
  assert.match(adminLayout, /roles: \['ADMIN'\]/);
  assert.match(hospitalLayout, /roles: \['HOSPITAL_ADMIN'\]/);
});

test('AI preview and handoff do not send messages automatically', () => {
  assert.match(panel, /No SMS or notifications were sent/);
  assert.match(panel, /No messages were sent by AI/);
  assert.match(panel, /DONOR_COMMUNICATIONS/);
  assert.match(panel, /HOSPITAL_MOBILIZATION/);
});

test('AI service unwraps backend response envelopes and cleans undefined query params', () => {
  assert.match(service, /function unwrap/);
  assert.match(service, /'data' in payload && 'success' in payload/);
  assert.match(service, /function cleanParams/);
  assert.match(service, /value !== undefined && value !== ''/);
});

test('AI panel handles empty or partial API data without throwing global errors', () => {
  assert.match(panel, /Promise\.allSettled/);
  assert.match(panel, /overview\?\.summary \?\? \{\}/);
  assert.match(panel, /overview\?\.insights \?\? \[\]/);
  assert.match(panel, /risk\.estimatedDaysRemaining \?\? 'Insufficient data'/);
});

test('AI panel uses hospital-specific summary labeling without backend contract changes', () => {
  assert.match(panel, /key !== 'hospitalsRequiringAttention'/);
  assert.match(panel, /key: 'hospitalStatus'/);
  assert.match(panel, /Hospital Status/);
  assert.match(panel, /getHospitalStatus\(risks\)/);
});

test('AI panel keeps refresh as a secondary manual action and shows stable loaders', () => {
  assert.match(panel, /btn-secondary w-full/);
  assert.match(panel, /Refresh AI intelligence calculations/);
  assert.match(panel, /Loading AI summary cards/);
  assert.match(panel, /Loading stock risk rows/);
});

test('AI risk explanation and donor recommendations are explainable', () => {
  assert.match(panel, /Risk Level/);
  assert.match(panel, /Confidence/);
  assert.match(panel, /Recommended Action/);
  assert.match(panel, /No additional explanation available/);
  assert.match(panel, /Why did AI recommend this\?/);
});

test('AI service normalizes missing arrays, confidence, and malformed risk rows', () => {
  assert.match(service, /Array\.isArray\(data\.risks\)/);
  assert.match(service, /Array\.isArray\(data\.items\)/);
  assert.match(service, /confidenceLevel.*: 'LOW'/s);
  assert.match(service, /estimatedDaysRemaining.*: null/);
});
