import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';

const controller = readFileSync('src/modules/blood-requests/blood-requests.controller.ts', 'utf8');
const service = readFileSync('src/modules/blood-requests/blood-requests.service.ts', 'utf8');
const schema = readFileSync('prisma/schema.prisma', 'utf8');

describe('Hospital active request summary consistency', () => {
  it('uses one shared active request query for the list and summary endpoints', () => {
    expect(controller).toContain("@Get('hospital-active/summary')");
    expect(service).toContain('getHospitalActiveContext');
    expect(service).toContain('hospitalActiveSummary');
    expect(service).toMatch(/listHospitalActive[\s\S]*getHospitalActiveContext/);
    expect(service).toMatch(/hospitalActiveSummary[\s\S]*getHospitalActiveContext/);
  });

  it('keeps the active request rule to open and matching requests', () => {
    expect(service).toContain('RequestStatus.OPEN');
    expect(service).toContain('RequestStatus.MATCHING');
    expect(service).toContain('RequestSource.HOSPITALS_ONLY');
    expect(service).toContain('RequestSource.DONORS_AND_HOSPITALS');
  });

  it('does not introduce unsupported roles', () => {
    expect(schema).toContain('ADMIN');
    expect(schema).toContain('DONOR');
    expect(schema).toContain('HOSPITAL_ADMIN');
    expect(controller).not.toContain('HOSPITAL_STAFF');
    expect(service).not.toContain('SUPER_ADMIN');
  });
});
