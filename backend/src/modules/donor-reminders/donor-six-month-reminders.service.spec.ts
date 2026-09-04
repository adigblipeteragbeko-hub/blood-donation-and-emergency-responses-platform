import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it, jest } from '@jest/globals';
import { PermissionCode, Role, SmsStatus } from '@prisma/client';
import { ROLE_PERMISSION_DEFAULTS } from '../../common/rbac/permission-matrix';
import { SmsService } from '../sms/sms.service';
import {
  DonorSixMonthRemindersService,
  SIX_MONTH_IN_APP_NOTIFICATION_TITLE,
  SIX_MONTH_REMINDER_MESSAGE,
  SIX_MONTH_REMINDER_TYPE,
  SIX_MONTH_TEST_REMINDER_MESSAGE,
  SIX_MONTH_TEST_REMINDER_TYPE,
} from './donor-six-month-reminders.service';

function donor(overrides: Record<string, unknown> = {}) {
  return {
    id: 'donor-1',
    donorNumber: 'DON-1',
    fullName: 'Akua Mensah',
    phone: '544515775',
    alternativePhoneNumber: null,
    bloodGroup: 'O_POS',
    eligibilityStatus: true,
    notificationSmsEnabled: true,
    user: { id: 'user-1', email: 'donor@example.test', isActive: true, role: Role.DONOR },
    clinicalRecords: [],
    donationHistory: [{ id: 'donation-1', donatedAt: new Date('2026-01-23T10:30:00.000Z') }],
    reminderLogs: [],
    ...overrides,
  };
}

function createService(returnedDonors: any[]) {
  const config = {
    get: jest.fn((key: string, fallback: unknown) => {
      if (key === 'donorSixMonthReminder.months') return 6;
      if (key === 'donorSixMonthReminder.timezone') return 'Africa/Accra';
      if (key === 'donorSixMonthReminder.cron') return '0 8 * * *';
      if (key === 'donorSixMonthReminder.enabled') return false;
      return fallback;
    }),
  };
  const smsService = new SmsService(config as any, { post: jest.fn() } as any, {} as any) as any;
  smsService.sendBulkSms = jest.fn(async (input: any) => ({
    success: true,
    status: SmsStatus.SENT,
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
    },
    donorReminderLog: {
      create: jest.fn(async (args: any) => ({ id: 'reminder-log-1', ...args.data })),
      update: jest.fn(async (args: any) => ({ id: args.where.id, ...args.data })),
    },
  };
  const audit = { log: jest.fn(async () => undefined) };
  const notificationsService = {
    createAndBroadcastNotification: jest.fn(async (input: any) => ({ id: 'notification-1', ...input })),
  };
  return {
    service: new DonorSixMonthRemindersService(prisma as any, audit as any, smsService as any, notificationsService as any, config as any),
    prisma,
    smsService,
    notificationsService,
    audit,
  };
}

describe('six-month donor encouragement reminders', () => {
  const controllerSource = readFileSync(join(__dirname, 'donor-reminders.controller.ts'), 'utf8');
  const serviceSource = readFileSync(join(__dirname, 'donor-six-month-reminders.service.ts'), 'utf8');
  const schemaSource = readFileSync(join(__dirname, '../../../prisma/schema.prisma'), 'utf8');

  it('adds admin-only dry-run and controlled test endpoints', () => {
    expect(controllerSource).toContain("@Controller('admin/donor-reminders/six-month')");
    expect(controllerSource).toContain('@Roles(Role.ADMIN)');
    expect(controllerSource).toContain("Post('preview')");
    expect(controllerSource).toContain("Post('test')");
    expect(controllerSource).toContain('PermissionCode.SMS_CAMPAIGN_VIEW');
    expect(controllerSource).toContain('PermissionCode.SMS_CAMPAIGN_MANAGE');
    expect(ROLE_PERMISSION_DEFAULTS[Role.ADMIN]).toEqual(expect.arrayContaining([
      PermissionCode.SMS_CAMPAIGN_VIEW,
      PermissionCode.SMS_CAMPAIGN_MANAGE,
    ]));
    expect(ROLE_PERMISSION_DEFAULTS[Role.DONOR]).not.toContain(PermissionCode.SMS_CAMPAIGN_MANAGE);
    expect(ROLE_PERMISSION_DEFAULTS[Role.HOSPITAL_ADMIN]).not.toContain(PermissionCode.SMS_CAMPAIGN_MANAGE);
  });

  it('stores a reminder log and dedicated SMS purpose for duplicate prevention and auditability', () => {
    expect(schemaSource).toContain('DONOR_SIX_MONTH_REMINDER');
    expect(schemaSource).toContain('model DonorReminderLog');
    expect(schemaSource).toContain('@@unique([donorId, reminderType, dueDate])');
    expect(serviceSource).toContain('DONOR_SIX_MONTH_REMINDER_JOB_STARTED');
    expect(serviceSource).toContain('DONOR_SIX_MONTH_REMINDER_SENT');
    expect(serviceSource).toContain('DONOR_SIX_MONTH_REMINDER_FAILED');
    expect(serviceSource).toContain('SIX_MONTH_IN_APP_NOTIFICATION_TITLE');
    expect(serviceSource).toContain('createAndBroadcastNotification');
    expect(serviceSource).toContain(SIX_MONTH_REMINDER_TYPE);
    expect(serviceSource).toContain(SIX_MONTH_TEST_REMINDER_TYPE);
  });

  it('uses the warmer GSM-compatible template and calculates two SMS segments', () => {
    const { service } = createService([]);

    expect(service.buildMessage()).toBe(
      "BloodSOS: It's been about 6 months since your last donation. Your next donation could save a life. Log in to review your status and book a donation if you're available.",
    );
    expect(service.buildMessage({ test: true })).toBe(
      "BloodSOS TEST: It's been about 6 months since your last donation. Your next donation could save a life. Log in to review your status and book a donation if you're available.",
    );
    expect(SIX_MONTH_REMINDER_MESSAGE).not.toContain('’');
    expect(SIX_MONTH_TEST_REMINDER_MESSAGE).toContain('BloodSOS TEST:');
    expect(SIX_MONTH_REMINDER_MESSAGE).not.toContain('TEST');
    expect(SIX_MONTH_REMINDER_MESSAGE).not.toMatch(/eligible|cleared|must donate/i);
    expect(service.calculateSmsMetrics(SIX_MONTH_REMINDER_MESSAGE, 1)).toEqual({
      characterCount: 168,
      encoding: 'GSM-7',
      segments: 2,
      estimatedCredits: 2,
    });
    expect(service.calculateSmsMetrics(SIX_MONTH_TEST_REMINDER_MESSAGE, 1)).toEqual({
      characterCount: 173,
      encoding: 'GSM-7',
      segments: 2,
      estimatedCredits: 2,
    });
  });

  it('previews due donors from completed Donation.donatedAt records without sending SMS', async () => {
    const { service, prisma, smsService, notificationsService } = createService([donor()]);

    const preview = await service.preview({ id: 'admin-1', role: Role.ADMIN });

    expect(preview.evaluatedDonors).toBe(1);
    expect(preview.dueDonors).toBe(1);
    expect(preview.eligibleRecipients).toBe(1);
    expect(preview.excluded.invalidPhone).toBe(0);
    expect(preview.estimatedCredits).toBe(2);
    expect(preview.testEstimatedCredits).toBe(2);
    expect(preview.messagePreview).toContain('about 6 months');
    expect(preview.testMessagePreview).toContain('BloodSOS TEST:');
    expect(preview.messagePreview).not.toContain('eligible');
    expect(preview.messagePreview).not.toContain('TEST');
    expect(preview.smsMetrics).toMatchObject({ characterCount: 168, encoding: 'GSM-7', segments: 2, estimatedCredits: 2 });
    expect(preview.testSmsMetrics).toMatchObject({ characterCount: 173, encoding: 'GSM-7', segments: 2, estimatedCredits: 2 });
    expect(smsService.sendBulkSms).not.toHaveBeenCalled();
    expect(prisma.donor.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { donationHistory: { some: {} } },
    }));
  });

  it('keeps Ghana phone normalization aligned with the working SmsService formats', () => {
    const smsService = new SmsService({ get: jest.fn() } as any, { post: jest.fn() } as any, {} as any);

    expect(smsService.normalizeGhanaPhone('544515775')).toBe('0544515775');
    expect(smsService.normalizeGhanaPhone('0544515775')).toBe('0544515775');
    expect(smsService.normalizeGhanaPhone('233544515775')).toBe('0544515775');
    expect(smsService.normalizeGhanaPhone('+233544515775')).toBe('0544515775');
  });

  it('excludes inactive, SMS-disabled, invalid-phone, ineligible, permanently deferred, and already-reminded donors', async () => {
    const dueDate = new Date('2026-07-23T00:00:00.000Z');
    const { service } = createService([
      donor({ id: 'inactive', user: { id: 'u1', email: 'a@example.test', isActive: false, role: Role.DONOR } }),
      donor({ id: 'sms-disabled', notificationSmsEnabled: false }),
      donor({ id: 'invalid-phone', phone: '123' }),
      donor({ id: 'ineligible', eligibilityStatus: false }),
      donor({ id: 'deferred', clinicalRecords: [{ status: 'PERMANENTLY_DEFERRED' }] }),
      donor({ id: 'reminded', reminderLogs: [{ reminderType: SIX_MONTH_REMINDER_TYPE, dueDate, status: 'SENT' }] }),
    ]);

    const preview = await service.preview({ id: 'admin-1', role: Role.ADMIN });

    expect(preview.eligibleRecipients).toBe(0);
    expect(preview.excluded).toMatchObject({
      inactiveAccount: 1,
      smsDisabled: 1,
      invalidPhone: 1,
      ineligible: 1,
      permanentlyDeferred: 1,
      alreadyReminded: 1,
    });
  });

  it('requires explicit confirmation before a one-recipient test SMS is sent', async () => {
    const { service, smsService } = createService([donor()]);

    const preview = await service.sendTest({ id: 'admin-1', role: Role.ADMIN }, 'donor-1', false);

    expect(preview).toMatchObject({
      requiresConfirmation: true,
      smsSent: false,
      eligibleRecipients: 1,
      estimatedCredits: 2,
      testEstimatedCredits: 2,
    });
    expect(smsService.sendBulkSms).not.toHaveBeenCalled();
  });

  it('allows the controlled TEST path to verify a valid opted-in phone without creating donation history', async () => {
    const { service, smsService } = createService([donor({ donationHistory: [] })]);

    const preview = await service.preview({ id: 'admin-1', role: Role.ADMIN }, 'donor-1');
    const testPreview = await service.sendTest({ id: 'admin-1', role: Role.ADMIN }, 'donor-1', false);

    expect(preview.excluded.noCompletedDonation).toBe(1);
    expect(preview.eligibleRecipients).toBe(0);
    expect(testPreview).toMatchObject({
      requiresConfirmation: true,
      smsSent: false,
      eligibleRecipients: 1,
      testEstimatedCredits: 2,
    });
    expect(smsService.sendBulkSms).not.toHaveBeenCalled();
  });

  it('sends exactly one controlled test SMS when confirmSend is true and keeps it separate from real reminders', async () => {
    const { service, prisma, smsService } = createService([donor({ phone: '+233544515775' })]);

    const result = await service.sendTest({ id: 'admin-1', role: Role.ADMIN }, 'donor-1', true);

    expect(result).toMatchObject({ smsSent: true, sentCount: 1, maskedPhone: '054***5775' });
    expect(smsService.sendBulkSms).toHaveBeenCalledWith(expect.objectContaining({
      recipients: ['0544515775'],
      message: SIX_MONTH_TEST_REMINDER_MESSAGE,
      purpose: 'DONOR_SIX_MONTH_REMINDER',
      relatedEntityType: 'DONOR_REMINDER_TEST',
    }));
    expect(prisma.donorReminderLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ reminderType: SIX_MONTH_TEST_REMINDER_TYPE, status: 'TEST_SENT' }),
    }));
  });

  it('sends real scheduled reminders only after creating a pending duplicate-prevention log', async () => {
    const { service, prisma, smsService, notificationsService } = createService([donor()]);

    const result = await service.runDueReminders();

    expect(result).toMatchObject({ enabled: false, sent: 0, failed: 0 });
    expect(smsService.sendBulkSms).not.toHaveBeenCalled();

    (service as any).config.get = jest.fn((key: string, fallback: unknown) => key === 'donorSixMonthReminder.enabled' ? true : fallback);
    const sent = await service.runDueReminders();

    expect(sent).toMatchObject({ enabled: true, dueDonors: 1, eligibleRecipients: 1, sent: 1, failed: 0 });
    expect(prisma.donorReminderLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ reminderType: SIX_MONTH_REMINDER_TYPE, status: 'PENDING' }),
    }));
    expect(smsService.sendBulkSms).toHaveBeenCalledWith(expect.objectContaining({
      relatedEntityType: 'DONOR_REMINDER',
      message: SIX_MONTH_REMINDER_MESSAGE,
      idempotencyKey: expect.stringContaining('donor-six-month:donor-1:'),
    }));
    expect(notificationsService.createAndBroadcastNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      title: SIX_MONTH_IN_APP_NOTIFICATION_TITLE,
      type: 'PROACTIVE_DONATION',
      channel: 'IN_APP',
    }));
  });

  it('does not retry a provider failure automatically for the controlled test endpoint', async () => {
    const { service, smsService } = createService([donor()]);
    smsService.sendBulkSms = jest.fn(async () => ({
      success: false,
      status: SmsStatus.FAILED,
      provider: 'bms_mnotify',
      requestedRecipients: 1,
      validRecipients: 1,
      sentCount: 0,
      rejectedCount: 1,
      skippedInvalidRecipients: 0,
      errorCode: 'INSUFFICIENT_CREDIT',
      errorMessage: 'Insufficient credits',
      smsLogId: 'sms-log-failed',
    }));

    const result = await service.sendTest({ id: 'admin-1', role: Role.ADMIN }, 'donor-1', true);

    expect(result).toMatchObject({
      smsSent: false,
      sentCount: 0,
      errorCode: 'INSUFFICIENT_CREDIT',
    });
    expect(smsService.sendBulkSms).toHaveBeenCalledTimes(1);
  });
});
