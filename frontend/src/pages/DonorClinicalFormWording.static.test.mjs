import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(join(process.cwd(), 'src/pages/DonorClinicalFormPage.tsx'), 'utf8');

test('donor health form uses clearer donor-friendly wording for all 22 questions', () => {
  const questionMatches = [...source.matchAll(/questionText: '/g)];
  const helperMatches = [...source.matchAll(/helperText: '/g)];

  assert.equal(questionMatches.length, 22);
  assert.equal(helperMatches.length, 22);
  assert.match(source, /Are you feeling healthy and well enough to donate blood today/);
  assert.match(source, /Have you ever been told by a healthcare professional or blood donation centre not to donate blood/);
  assert.match(source, /prescription or over-the-counter medication/);
  assert.match(source, /epilepsy, stomach ulcer, heart disease, cancer, or another serious medical condition/);
});

test('donor health form groups questions and hides raw q-number labels from the UI', () => {
  [
    'Current Health',
    'Medical History',
    'Current Medication',
    'Infectious Diseases',
    'Vaccinations',
    'Lifestyle & Exposure',
    'Lifestyle & Work Safety',
    'Previous Blood Donations',
    'Pregnancy & Breastfeeding',
  ].forEach((section) => assert.match(source, new RegExp(section)));

  assert.match(source, /questionKey: `q\$\{index \+ 1\}`/);
  assert.match(source, /replace\('q', 'Question '\)/);
  assert.doesNotMatch(source, /\{q\.questionKey\}\. \{q\.questionText\}/);
});

test('donor health form exposes accessible helper text and medical term tooltips', () => {
  assert.match(source, /aria-describedby=\{helperId\}/);
  assert.match(source, /aria-pressed=\{answer\?\.answer === 'yes'\}/);
  assert.match(source, /role="tooltip"/);
  assert.match(source, /Epilepsy/);
  assert.match(source, /Tuberculosis/);
  assert.match(source, /Hepatitis/);
  assert.match(source, /Cancer/);
  assert.match(source, /Heart Disease/);
});
