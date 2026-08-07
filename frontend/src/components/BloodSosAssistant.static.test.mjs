import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const assistant = readFileSync(new URL('./BloodSosAssistant.tsx', import.meta.url), 'utf8');
const floating = readFileSync(new URL('./FloatingAssistantLauncher.tsx', import.meta.url), 'utf8');
const service = readFileSync(new URL('../services/assistant.ts', import.meta.url), 'utf8');
const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const mainLayout = readFileSync(new URL('../layouts/MainLayout.tsx', import.meta.url), 'utf8');
const donorLayout = readFileSync(new URL('../layouts/DonorPortalLayout.tsx', import.meta.url), 'utf8');
const hospitalLayout = readFileSync(new URL('../layouts/HospitalPortalLayout.tsx', import.meta.url), 'utf8');
const adminLayout = readFileSync(new URL('../layouts/AdminPortalLayout.tsx', import.meta.url), 'utf8');
const adminManagement = readFileSync(new URL('../pages/AdminManagementPage.tsx', import.meta.url), 'utf8');

test('assistant routes and menus are visible for public, donor, hospital admin, and admin', () => {
  assert.match(app, /path="\/assistant"/);
  assert.match(app, /path="assistant" element=\{<AssistantPage \/>/);
  assert.match(mainLayout, /\['\/assistant', 'Assistant'\]/);
  assert.match(donorLayout, /\/donor\/assistant/);
  assert.match(hospitalLayout, /\/hospital\/assistant/);
  assert.match(adminLayout, /section=assistant/);
  assert.match(adminManagement, /activeSection === 'assistant'/);
});

test('assistant frontend uses shared role-aware component and backend endpoints', () => {
  assert.match(service, /\/assistant\/public\/message/);
  assert.match(service, /\/assistant\/message/);
  assert.match(service, /\/assistant\/suggestions/);
  assert.match(assistant, /BloodSOS Assistant/);
  assert.match(assistant, /suggestedQuestions/);
  assert.match(assistant, /quickActions/);
});

test('assistant blocks arbitrary navigation and supports accessible input states', () => {
  assert.match(assistant, /route\.startsWith\('http:\/\/'\)/);
  assert.match(assistant, /route\.startsWith\('https:\/\/'\)/);
  assert.match(assistant, /aria-live="polite"/);
  assert.match(assistant, /Shift\+Enter/);
  assert.match(assistant, /Retry/);
  assert.match(assistant, /Clear Conversation/);
});

test('floating assistant opens an in-page drawer and links to role-specific full routes', () => {
  assert.match(floating, /Open BloodSOS Assistant/);
  assert.match(floating, /BloodSOS Assistant drawer/);
  assert.match(floating, /Open Full Assistant/);
  assert.match(floating, /\/donor\/assistant/);
  assert.match(floating, /\/hospital\/assistant/);
  assert.match(floating, /\/admin\/management\?section=assistant/);
  assert.match(mainLayout, /FloatingAssistantLauncher/);
  assert.match(hospitalLayout, /FloatingAssistantLauncher/);
  assert.match(adminLayout, /FloatingAssistantLauncher/);
});

test('assistant does not expose unsupported role names', () => {
  for (const unsupported of ['SUPER' + '_ADMIN', 'HOSPITAL' + '_STAFF', 'AUDITOR', 'CONTENT' + '_ADMIN']) {
    assert.equal(assistant.includes(unsupported), false);
    assert.equal(service.includes(unsupported), false);
  }
});
