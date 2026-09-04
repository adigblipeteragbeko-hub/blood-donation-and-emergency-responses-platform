import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(join(process.cwd(), 'src/pages/DonorClinicalFormPage.tsx'), 'utf8');

test('donor health form uses the shortened donor-friendly eligibility screening questions', () => {
  const questionMatches = [...source.matchAll(/questionText: '/g)];
  const helperMatches = [...source.matchAll(/helperText: '/g)];

  assert.equal(questionMatches.length, 9);
  assert.equal(helperMatches.length, 9);
  assert.match(source, /Are you feeling healthy and well enough to donate blood today/);
  assert.match(source, /Have you ever been told by a healthcare professional or blood donation centre not to donate blood/);
  assert.match(source, /medication, treatment, or antibiotics/);
  assert.match(source, /heart disease, cancer, epilepsy, tuberculosis, sickle cell disease, or another serious medical condition/);
  assert.match(source, /pregnant, recently pregnant, or breastfeeding/);
  assert.match(source, /allowNotApplicable: true/);
});

test('donor health form groups questions into the shorter workflow and hides raw q-number labels from the UI', () => {
  [
    'Current Health',
    'Previous Blood Donations',
    'Short Health Pre-Screening',
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

test('donor health form opens detail boxes only for risk answers', () => {
  assert.match(source, /const isFeelingWellQuestion = question\.questionKey === 'q1'/);
  assert.match(source, /const riskAnswerSelected = isFeelingWellQuestion \? selectedAnswer === 'no' : selectedAnswer === 'yes'/);
  assert.match(source, /q\.questionKey === 'q1' && feelingWellDetailsAttempted && feelingWellNeedsDetails/);
  assert.match(source, /Please explain why you are not feeling well enough to donate today/);
  assert.match(source, /Please provide an explanation before continuing/);
  assert.match(source, /bg-green-600 text-white ring-2 ring-green-600/);
  assert.match(source, /bg-red-600 text-white ring-2 ring-red-600/);
  assert.match(source, /Not Applicable/);
  assert.match(source, /details: answers\[q\.questionKey\]\?\.answer === 'na' \? 'Not Applicable'/);
});

test('donor login redirects first-time or eligible-again donors to the health form', () => {
  const loginForm = readFileSync(join(process.cwd(), 'src/components/LoginForm.tsx'), 'utf8');

  assert.match(loginForm, /getDonorLandingPath/);
  assert.match(loginForm, /\/donor-clinical-records\/me/);
  assert.match(loginForm, /!latest \|\| latest\.status === 'DRAFT' \|\| canReassessAfterDeferral/);
  assert.match(loginForm, /\/donor\/health-form\?required=1/);
  assert.match(loginForm, /latest\.status !== 'APPROVED'/);
  assert.match(loginForm, /\/donor\/eligibility/);
  assert.match(loginForm, /nextRole === 'DONOR' \? await getDonorLandingPath\(\) : getRoleLandingPath/);
  assert.match(source, /Complete Your Eligibility Form/);
  assert.match(source, /Before you can participate in blood donation activities, please complete this short eligibility form/);
});
