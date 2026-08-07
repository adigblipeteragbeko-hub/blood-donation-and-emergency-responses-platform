import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('./HospitalDonorSearchPage.tsx', import.meta.url), 'utf8');

test('renders general and active emergency donor-search context copy', () => {
  assert.match(source, /General donor search for the logged-in hospital/);
  assert.match(source, /Searching compatible donors for a/);
  assert.match(source, /Logged-in Hospital/);
  assert.match(source, /Requesting Hospital/);
  assert.match(source, /Search Origin/);
});

test('renders request facts, filter labels, compatible helper, and aria-live feedback', () => {
  ['Blood Needed', 'Donor Availability', 'Search Radius', 'Blood Component', 'Units Required', 'Priority', 'Matching Mode'].forEach((text) =>
    assert.match(source, new RegExp(text)),
  );
  assert.match(source, /according to the platform's compatibility rules/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /disabled=\{loading \|\| requestLoading\}/);
});

test('uses dynamic map legend and correct marker meanings', () => {
  assert.match(source, /function MapLegend/);
  assert.match(source, /Available eligible donor/);
  assert.match(source, /Hospital, request, or selected search origin/);
  assert.match(source, /Stale or limited location data/);
  assert.match(source, /markerTypes\.map/);
});

test('does not render obsolete map-ready label and uses location-available wording', () => {
  assert.doesNotMatch(source, /Map ready/);
  assert.match(source, /Location Available/);
  assert.match(source, /Location available/);
});

test('renders states, retry behavior, match reason, stale warning, and privacy notice', () => {
  [
    'Searching for compatible donors',
    'No eligible donors were found within the selected radius',
    'Matching donors were found, but no usable location data is available',
    'Unable to load the donor map. Please retry.',
    'Retry',
    'Why this donor matches',
    'Some donor locations may be outdated.',
    'Donor location information is restricted to authorized hospital staff',
  ].forEach((text) => assert.match(source, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
});

test('reuses existing socket infrastructure with stable debounced cleanup', () => {
  assert.match(source, /createRealtimeSocket/);
  assert.match(source, /donor\.search\.invalidated/);
  assert.match(source, /donor\.location\.updated/);
  assert.match(source, /emergency\.request\.updated/);
  assert.match(source, /window\.setTimeout/);
  assert.match(source, /window\.clearTimeout/);
  assert.match(source, /socket\.off/);
  assert.match(source, /socket\.disconnect/);
  assert.match(source, /Donor results updated/);
});

test('does not render exact sensitive coordinates as visible text', () => {
  assert.doesNotMatch(source, /Latitude:/);
  assert.doesNotMatch(source, /Longitude:/);
});
