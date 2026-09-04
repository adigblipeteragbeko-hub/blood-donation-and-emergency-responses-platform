import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();
const donorRegister = readFileSync(join(root, 'src/pages/DonorRegisterPage.tsx'), 'utf8');
const verifyEmail = readFileSync(join(root, 'src/pages/VerifyEmailPage.tsx'), 'utf8');
const loginForm = readFileSync(join(root, 'src/components/LoginForm.tsx'), 'utf8');
const css = readFileSync(join(root, 'src/index.css'), 'utf8');

test('donor registration offers email or SMS verification delivery', () => {
  assert.match(donorRegister, /verificationMethod/);
  assert.match(donorRegister, /How would you like to receive your verification code/);
  assert.match(donorRegister, /Email/);
  assert.match(donorRegister, /SMS/);
  assert.match(donorRegister, /maskedEmail/);
  assert.match(donorRegister, /maskedPhone/);
});

test('verification page supports five-minute fallback and switching', () => {
  assert.match(verifyEmail, /expiresInMinutes \?\? 5/);
  assert.match(verifyEmail, /Code sent by/);
  assert.match(verifyEmail, /Resend by SMS|Resend by Email/);
  assert.match(verifyEmail, /Send by SMS|Send by Email/);
  assert.match(verifyEmail, /resendCooldownSeconds \?\? 45/);
  assert.doesNotMatch(verifyEmail, /10 \* 60/);
});

test('login verification prompt no longer says SMS is disabled', () => {
  assert.doesNotMatch(loginForm, /SMS verification is not enabled yet/);
  assert.match(loginForm, /switch delivery method/);
});

test('auth placeholders are visibly grey while entered text stays dark', () => {
  assert.match(css, /input::placeholder,\s*textarea::placeholder\s*\{\s*color: #94a3b8;/s);
  assert.match(css, /\.legacy-input[\s\S]*color: var\(--text-primary\);/);
  assert.match(loginForm, /placeholder="Email address"/);
  assert.match(loginForm, /placeholder="Password"/);
});

test('verification success message appears before redirecting to login', () => {
  assert.match(verifyEmail, /setVerified\(true\)/);
  assert.match(verifyEmail, /Account Verified Successfully!/);
  assert.match(verifyEmail, /Your account has been successfully verified\. You can now log in\./);
  assert.match(verifyEmail, /Redirecting you to login/);
  assert.match(verifyEmail, /window\.setTimeout/);
  assert.match(verifyEmail, /2500/);
  assert.match(verifyEmail, /disabled=\{submitting \|\| verified\}/);
});
