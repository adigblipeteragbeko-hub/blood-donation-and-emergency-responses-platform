import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from '@jest/globals';

describe('donor clinical records shortened eligibility workflow', () => {
  const serviceSource = readFileSync(join(__dirname, 'donor-clinical-records.service.ts'), 'utf8');

  it('accepts the shortened screening answer set without the legacy 22-question gate', () => {
    expect(serviceSource).toContain('MINIMUM_HEALTH_SCREENING_ANSWERS = 9');
    expect(serviceSource).toContain('All eligibility screening questions must be answered.');
    expect(serviceSource).not.toContain('All 22 health questionnaire questions must be answered.');
  });

  it('flags the first question when answered No and preserves Yes-risk questions for hospital review', () => {
    expect(serviceSource).toContain("const RISK_NO_KEYS = new Set(['q1'])");
    expect(serviceSource).toContain('this.isRiskAnswer(answer)');
    expect(serviceSource).toContain('!answer.answer && RISK_NO_KEYS.has(answer.questionKey)');
  });

  it('allows a new donor draft only after a temporary deferral window has ended', () => {
    expect(serviceSource).toContain('canCreateAfterTemporaryDeferral');
    expect(serviceSource).toContain("latest?.status === DonorClinicalStatus.TEMPORARILY_DEFERRED");
    expect(serviceSource).toContain('donor.nextEligibilityDate <= new Date()');
  });
});
