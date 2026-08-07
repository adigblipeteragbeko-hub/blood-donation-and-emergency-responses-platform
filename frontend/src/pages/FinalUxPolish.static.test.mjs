import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(join(process.cwd(), path), 'utf8');

test('donor-facing dashboard and appointment empty states explain what appears next', () => {
  const donorDashboard = read('src/pages/DonorDashboardPage.tsx');
  const appointments = read('src/pages/AppointmentsPage.tsx');

  assert.match(donorDashboard, /No recent activity yet\. Appointment updates, donations, and notifications will appear here\./);
  assert.match(donorDashboard, /No alerts right now\. Emergency requests and appointment reminders will appear here\./);
  assert.match(appointments, /No appointments found\. New hospital appointments and your booking history will appear here\./);
});

test('clinical form loading state is accessible and avoids terse placeholder copy', () => {
  const clinicalForm = read('src/pages/DonorClinicalFormPage.tsx');

  assert.match(clinicalForm, /aria-busy="true"/);
  assert.match(clinicalForm, /aria-live="polite"/);
  assert.match(clinicalForm, /Loading your health eligibility form/);
  assert.doesNotMatch(clinicalForm, /Loading clinical form\.\.\./);
});

test('visible polish copy keeps consistent capitalization and helpful disabled-action guidance', () => {
  const verifyEmail = read('src/pages/VerifyEmailPage.tsx');
  const map = read('src/components/LiveOperationsMap.tsx');
  const activeRequests = read('src/pages/HospitalActiveRequestsPage.tsx');
  const hospitalDashboard = read('src/pages/HospitalDashboardPage.tsx');
  const stockIntelligence = read('src/pages/HospitalStockIntelligencePage.tsx');
  const hospitalAppointments = read('src/pages/HospitalAppointmentsPage.tsx');

  assert.match(verifyEmail, /Back to Login/);
  assert.doesNotMatch(verifyEmail, /Back To Login/);
  assert.match(map, /Open donor search to send alerts through the approved workflow\./);
  assert.match(activeRequests, /Blood Group is locked after coordination starts/);
  assert.match(hospitalDashboard, /No alerts right now\. Critical stock warnings and emergency notifications will appear here\./);
  assert.match(stockIntelligence, /No alerts right now\. New stock warnings and mobilisation updates will appear here\./);
  assert.match(hospitalAppointments, /No appointments found for the selected filters\. New bookings and donor responses will appear here\./);
});
