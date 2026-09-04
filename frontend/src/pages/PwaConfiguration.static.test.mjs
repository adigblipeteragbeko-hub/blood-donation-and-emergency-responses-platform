import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const viteConfig = readFileSync(new URL('../../vite.config.ts', import.meta.url), 'utf8');
const installPrompt = readFileSync(new URL('../components/PwaInstallPrompt.tsx', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

test('PWA manifest keeps one installable BloodSOS app for all roles', () => {
  assert.match(viteConfig, /VitePWA\(/);
  assert.match(viteConfig, /name:\s*'Blood Donation and Emergency Response Platform'/);
  assert.match(viteConfig, /short_name:\s*'BloodSOS'/);
  assert.match(viteConfig, /display:\s*'standalone'/);
  assert.match(viteConfig, /start_url:\s*'\/'/);
  assert.match(viteConfig, /scope:\s*'\/'/);
  assert.match(viteConfig, /theme_color:\s*'#c8102e'/);
});

test('PWA service worker does not cache sensitive authenticated API namespaces', () => {
  [
    '/auth',
    '/inventory',
    '/blood-requests',
    '/appointments',
    '/notifications',
    '/donors',
    '/hospitals',
    '/donor-clinical-records',
    '/reports',
  ].forEach((path) => {
    assert.match(viteConfig, new RegExp(path.replaceAll('/', '\\/')));
  });
  assert.match(viteConfig, /handler:\s*'NetworkOnly'/);
});

test('PWA install, update, offline and iOS guidance are present', () => {
  assert.match(installPrompt, /beforeinstallprompt/);
  assert.match(installPrompt, /useRegisterSW/);
  assert.match(installPrompt, /A new version of BloodSOS is available/);
  assert.match(installPrompt, /You are currently offline/);
  assert.match(installPrompt, /Add to Home Screen/);
});

test('HTML exposes mobile PWA metadata and touch icon', () => {
  assert.match(indexHtml, /mobile-web-app-capable/);
  assert.match(indexHtml, /apple-mobile-web-app-capable/);
  assert.match(indexHtml, /apple-touch-icon/);
});
