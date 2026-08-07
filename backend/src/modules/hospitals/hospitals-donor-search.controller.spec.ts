import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

const controllerSource = readFileSync(join(__dirname, 'hospitals.controller.ts'), 'utf8');

describe('HospitalsController donor-search route protection', () => {
  it('keeps donor search on the protected hospital route', () => {
    expect(controllerSource).toContain("@Get('donor-search')");
    expect(controllerSource).toContain('JwtAccessGuard');
    expect(controllerSource).toContain('ActiveUserGuard');
    expect(controllerSource).toContain('RolesGuard');
    expect(controllerSource).toContain('PermissionsGuard');
  });

  it('requires donor match view permission for donor location search', () => {
    expect(controllerSource).toContain('PermissionCode.DONOR_MATCH_VIEW');
    expect(controllerSource).toContain("donorSearch(@CurrentUser() user: { id: string }, @Query() query: DonorSearchDto)");
  });
});
