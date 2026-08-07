import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..', '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('manual testing stabilization safeguards', () => {
  it('keeps roles limited to the approved platform roles', () => {
    const schema = read('prisma/schema.prisma');
    expect(schema).toContain('enum Role {\n  ADMIN\n  DONOR\n  HOSPITAL_ADMIN\n}');
    expect(schema).not.toContain('SUPER_ADMIN');
    expect(schema).not.toContain('HOSPITAL_STAFF');
  });

  it('validates and normalizes document numbers without claiming authenticity', () => {
    const service = read('src/modules/donor-clinical-records/donor-clinical-records.service.ts');
    expect(service).toContain('^GHA-[0-9]{9}-[0-9]$');
    expect(service).toContain('toUpperCase()');
    expect(service).toContain('This checks format only and does not verify authenticity.');
    expect(service).toContain('maskDocumentNumber');
    expect(service).toContain('redactClinicalAuditValue');
    expect(service).not.toContain('Ghana Card verified');
  });

  it('separates account approval wording from clinical eligibility approval', () => {
    const service = read('src/modules/donors/donors.service.ts');
    const controller = read('src/modules/donors/donors.controller.ts');
    expect(service).toContain('Your account is approved. Complete and submit your Health & Eligibility Form');
    expect(service).toContain('Your account and clinical eligibility are approved. You may now update your availability.');
    expect(controller).toContain("@Patch('admin/:id/account-status')");
    expect(service).toContain('updateAccountStatusByAdmin');
    expect(service).toContain("user: { update: { isActive: active } }");
    expect(service).toContain('Clinical eligibility was not changed.');
    expect(service).toContain('DONOR_ACCOUNT_STATUS_UPDATED');
  });

  it('keeps operational donor matching gated by account and clinical approval', () => {
    const hospitalSearch = read('src/modules/hospitals/hospitals.service.ts');
    const inventory = read('src/modules/inventory/inventory.service.ts');
    const ai = read('src/modules/ai-intelligence/ai-intelligence.service.ts');

    [hospitalSearch, inventory, ai].forEach((source) => {
      expect(source).toContain('eligibilityStatus: true');
      expect(source).toContain('availabilityStatus: true');
      expect(source).toContain('emailVerified: true');
      expect(source).toContain('DonorClinicalStatus.APPROVED');
    });
    expect(inventory).toContain('notificationConsentDisabled');
    expect(ai).toContain('notificationEmailEnabled: true');
    expect(ai).toContain('notificationSmsEnabled: true');
  });

  it('stores cannot-fulfil as a hospital-specific response without closing global request flow', () => {
    const service = read('src/modules/blood-requests/blood-requests.service.ts');
    expect(service).toContain('HospitalRequestResponseType.CANNOT_FULFILL');
    expect(service).toContain('Enter a reason before marking this request as unable to fulfil.');
    expect(service).toContain('HospitalRequestResponseStatus.CANCELLED');
    expect(service).not.toContain('request.status = RequestStatus.CANCELLED');
  });

  it('returns privacy-safe donor search exclusion diagnostics', () => {
    const service = read('src/modules/hospitals/hospitals.service.ts');
    expect(service).toContain('exclusionSummary');
    expect(service).toContain('evaluatedDonors');
    expect(service).toContain('outsideRadius');
    expect(service).toContain('missingOrStaleLocation');
  });
});
