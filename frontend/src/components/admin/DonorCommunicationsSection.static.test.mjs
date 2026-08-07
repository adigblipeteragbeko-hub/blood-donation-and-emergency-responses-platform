import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const component = readFileSync(new URL('./DonorCommunicationsSection.tsx', import.meta.url), 'utf8');
const service = readFileSync(new URL('../../services/admin-donor-communications.ts', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../../layouts/AdminPortalLayout.tsx', import.meta.url), 'utf8');
const page = readFileSync(new URL('../../pages/AdminManagementPage.tsx', import.meta.url), 'utf8');

describe('Admin donor communications UI wiring', () => {
  it('adds an admin control center menu item and section route', () => {
    assert.match(layout, /section=donor-communications/);
    assert.match(layout, /Donor Communications/);
    assert.match(page, /DonorCommunicationsSection/);
    assert.match(page, /activeSection === 'donor-communications'/);
  });

  it('renders filters, masked operational columns, export, SMS preview, and confirmation controls', () => {
    assert.match(component, /Name, email, or phone/);
    assert.match(component, /SMS enabled/);
    assert.match(component, /maskedPhone/);
    assert.match(component, /maskedEmail/);
    assert.match(component, /Export contacts/);
    assert.match(component, /Send bulk SMS/);
    assert.match(component, /Type SEND to confirm/);
    assert.match(component, /Preview summary/);
    assert.doesNotMatch(component, /dangerouslySetInnerHTML/);
  });

  it('uses real backend endpoints and blob export instead of fake success flows', () => {
    assert.match(service, /admin\/donor-communications\/donors/);
    assert.match(service, /admin\/donor-communications\/export/);
    assert.match(service, /admin\/donor-communications\/sms\/preview/);
    assert.match(service, /admin\/donor-communications\/sms\/campaigns/);
    assert.match(service, /responseType: 'blob'/);
  });

  it('makes explicit donor selection win over stale filtered selection', () => {
    assert.match(component, /const selectionMode = selected\.size > 0 \? 'EXPLICIT'/);
    assert.match(component, /setSelected\(new Set\(data\.items\.map\(\(item\) => item\.id\)\)\); setSelectAllFiltered\(false\); setSmsPreview\(null\);/);
    assert.match(component, /setSelectAllFiltered\(false\);\n    setSmsPreview\(null\);/);
  });
});
