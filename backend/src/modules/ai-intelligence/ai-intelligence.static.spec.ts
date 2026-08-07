import { PermissionCode, Role } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ROLE_PERMISSION_DEFAULTS } from '../../common/rbac/permission-matrix';

const root = join(__dirname, '..', '..', '..');

function source(path: string) {
  return readFileSync(join(root, path), 'utf8');
}

describe('AI Intelligence role and access wiring', () => {
  it('keeps the active Prisma role enum to the approved three roles', () => {
    const schema = source('prisma/schema.prisma');
    const match = schema.match(/enum Role \{([\s\S]*?)\}/);
    expect(match?.[1].trim().split(/\s+/)).toEqual(['ADMIN', 'DONOR', 'HOSPITAL_ADMIN']);
  });

  it('assigns AI permissions only to admin and hospital admin defaults', () => {
    const aiPermissions = [
      PermissionCode.AI_INTELLIGENCE_VIEW,
      PermissionCode.AI_STOCK_RISK_VIEW,
      PermissionCode.AI_DONOR_RECOMMENDATION_VIEW,
      PermissionCode.AI_MOBILIZATION_PREVIEW,
      PermissionCode.AI_RECOMMENDATION_HISTORY_VIEW,
    ];
    expect(ROLE_PERMISSION_DEFAULTS[Role.ADMIN]).toEqual(expect.arrayContaining(aiPermissions));
    expect(ROLE_PERMISSION_DEFAULTS[Role.HOSPITAL_ADMIN]).toEqual(expect.arrayContaining(aiPermissions));
    expect(ROLE_PERMISSION_DEFAULTS[Role.DONOR]).not.toEqual(expect.arrayContaining(aiPermissions));
  });

  it('protects AI endpoints with admin and hospital admin roles only', () => {
    const controller = source('src/modules/ai-intelligence/ai-intelligence.controller.ts');
    expect(controller).toContain('@Roles(Role.ADMIN, Role.HOSPITAL_ADMIN)');
    expect(controller).not.toContain('Role.DONOR');
  });

  it('does not introduce an external AI provider dependency', () => {
    const service = source('src/modules/ai-intelligence/ai-intelligence.service.ts');
    expect(service).not.toMatch(/OpenAI|Gemini|Claude|anthropic/i);
    expect(service).toContain('getCompatibleDonorGroups');
  });
});
