import { readFileSync } from 'fs';
import { join } from 'path';
import { PermissionCode, Role } from '@prisma/client';
import { describe, expect, it, jest } from '@jest/globals';
import { ROLE_PERMISSION_DEFAULTS } from '../../common/rbac/permission-matrix';
import { AdminDonorCommunicationsService } from './admin-donor-communications.service';
import { SmsService } from '../sms/sms.service';

describe('Admin donor communications feature', () => {
  const controllerSource = readFileSync(join(__dirname, 'admin-donor-communications.controller.ts'), 'utf8');
  const serviceSource = readFileSync(join(__dirname, 'admin-donor-communications.service.ts'), 'utf8');
  const schemaSource = readFileSync(join(__dirname, '../../../prisma/schema.prisma'), 'utf8');

  it('protects donor communications endpoints for platform admins only', () => {
    expect(controllerSource).toContain("@Controller('admin/donor-communications')");
    expect(controllerSource).toContain('@Roles(Role.ADMIN)');
    expect(controllerSource).toContain('JwtAccessGuard');
    expect(controllerSource).toContain('RolesGuard');
    expect(controllerSource).toContain('PermissionsGuard');
    expect(controllerSource).toContain('PermissionCode.DONOR_CONTACT_VIEW');
    expect(controllerSource).toContain('PermissionCode.DONOR_CONTACT_EXPORT');
    expect(controllerSource).toContain('PermissionCode.SMS_CAMPAIGN_MANAGE');
    expect(ROLE_PERMISSION_DEFAULTS[Role.ADMIN]).toEqual(expect.arrayContaining([
      PermissionCode.DONOR_CONTACT_VIEW,
      PermissionCode.DONOR_CONTACT_EXPORT,
      PermissionCode.SMS_CAMPAIGN_MANAGE,
      PermissionCode.SMS_CAMPAIGN_VIEW,
    ]));
    expect(ROLE_PERMISSION_DEFAULTS[Role.HOSPITAL_ADMIN]).not.toContain(PermissionCode.DONOR_CONTACT_EXPORT);
    expect(ROLE_PERMISSION_DEFAULTS[Role.DONOR]).not.toContain(PermissionCode.SMS_CAMPAIGN_MANAGE);
  });

  it('supports filtering, CSV export safety, SMS preview, and campaign history', () => {
    expect(serviceSource).toContain('buildWhere');
    expect(serviceSource).toContain('DONOR_CONTACTS_EXPORTED');
    expect(serviceSource).toContain('SMS_CAMPAIGN_PREVIEWED');
    expect(serviceSource).toContain('SMS_CAMPAIGN_COMPLETED');
    expect(serviceSource).toContain('csvValue');
    expect(serviceSource).toContain('DONOR_MOBILIZATION');
    expect(serviceSource).toContain('normalizeGhanaPhone');
    expect(serviceSource).toContain('duplicatePhone');
    expect(serviceSource).toContain('PERMANENTLY_DEFERRED');
    expect(serviceSource).toContain('chunk(analysis.eligible');
  });

  it('adds persistent campaign tracking models without storing full recipient lists', () => {
    expect(schemaSource).toContain('model SmsCampaign');
    expect(schemaSource).toContain('model SmsCampaignRecipient');
    expect(schemaSource).toContain('maskedPhone');
    expect(schemaSource).not.toContain('recipientPhone String');
  });
});

function donor(overrides: Record<string, unknown> = {}) {
  return {
    id: 'donor-1',
    donorNumber: 'DON-1',
    fullName: 'Valid Donor',
    phone: '544515775',
    alternativePhoneNumber: null,
    bloodGroup: 'O_POS',
    region: 'Greater Accra',
    city: 'Tema',
    eligibilityStatus: true,
    notificationSmsEnabled: true,
    lastDonationDate: null,
    createdAt: new Date(),
    user: { id: 'user-1', email: 'donor@example.test', isActive: true, role: Role.DONOR },
    preferredHospital: null,
    clinicalRecords: [],
    ...overrides,
  };
}

function createService(returnedDonors: any[]) {
  const config = { get: jest.fn((key: string, fallback: unknown) => fallback) };
  const smsService = new SmsService(config as any, { post: jest.fn() } as any, {} as any) as any;
  smsService.sendBulkSms = jest.fn(async (input: any) => ({
    success: true,
    status: 'SENT',
    provider: 'bms_mnotify',
    providerCampaignId: 'provider-1',
    requestedRecipients: input.recipients.length,
    validRecipients: input.recipients.length,
    sentCount: input.recipients.length,
    rejectedCount: 0,
    skippedInvalidRecipients: 0,
    creditUsed: input.recipients.length,
    smsLogId: 'sms-log-1',
  }));
  const prisma = {
    donor: {
      findMany: jest.fn(async () => returnedDonors),
      count: jest.fn(async () => returnedDonors.length),
    },
    smsCampaign: {
      create: jest.fn(async (args: any) => ({ id: 'campaign-1', ...args.data })),
      update: jest.fn(async (args: any) => ({ id: args.where.id, ...args.data })),
      count: jest.fn(async () => 0),
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(async () => null),
    },
    smsCampaignRecipient: {
      createMany: jest.fn(async () => ({ count: returnedDonors.length })),
      updateMany: jest.fn(async () => ({ count: returnedDonors.length })),
    },
  };
  const audit = { log: jest.fn(async () => undefined) };
  return {
    service: new AdminDonorCommunicationsService(prisma as any, audit as any, smsService as any, config as any),
    prisma,
    smsService,
  };
}

describe('Admin donor communications recipient resolution', () => {
  it('keeps one explicit selected donor as requestedDonors = 1 even when stale filters are present', async () => {
    const { service, prisma } = createService([donor({ countryCode: '+233', phone: '544515775' })]);

    const preview = await service.previewSms(
      { id: 'admin-1', role: Role.ADMIN },
      {
        donorIds: ['donor-1'],
        filters: { smsEnabled: 'true', city: 'Tema' },
        selectionMode: 'EXPLICIT',
        message: 'BloodSOS: test message',
      },
    );

    expect(preview.requestedDonors).toBe(1);
    expect(preview.eligibleRecipients).toBe(1);
    expect(preview.excluded.invalidPhone).toBe(0);
    expect(preview.estimatedCredits).toBe(1);
    expect(prisma.donor.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ['donor-1'] } },
    }));
  });

  it('supports the donor profile split country-code plus local phone shape', async () => {
    const { service } = createService([donor({ phoneCountryCode: '+233', phone: '544515775' })]);

    const preview = await service.previewSms(
      { id: 'admin-1', role: Role.ADMIN },
      {
        donorIds: ['donor-1'],
        selectionMode: 'EXPLICIT',
        message: 'BloodSOS: test message',
      },
    );

    expect(preview).toMatchObject({
      requestedDonors: 1,
      eligibleRecipients: 1,
      estimatedCredits: 1,
    });
    expect(preview.excluded.invalidPhone).toBe(0);
  });

  it('uses the same recipient resolution for preview and actual campaign', async () => {
    const { service, smsService } = createService([donor({ phone: '+233544515775' })]);
    const payload = {
      donorIds: ['donor-1'],
      selectionMode: 'EXPLICIT' as const,
      message: 'BloodSOS: Your appointment SMS number remains valid.',
    };

    const preview = await service.previewSms({ id: 'admin-1', role: Role.ADMIN }, payload);
    const campaign = await service.launchCampaign(
      { id: 'admin-1', role: Role.ADMIN },
      { ...payload, name: 'Single donor test', confirmationText: 'SEND' },
    );

    expect(preview.requestedDonors).toBe(1);
    expect(campaign.requestedDonors).toBe(1);
    expect(campaign.eligibleRecipients).toBe(preview.eligibleRecipients);
    expect(smsService.sendBulkSms).toHaveBeenCalledWith(expect.objectContaining({
      recipients: ['0544515775'],
    }));
  });
});
