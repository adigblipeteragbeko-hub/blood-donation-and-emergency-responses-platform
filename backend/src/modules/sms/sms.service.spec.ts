import { BadRequestException } from '@nestjs/common';
import { SmsPurpose, SmsStatus } from '@prisma/client';
import { describe, expect, it, jest } from '@jest/globals';
import { of, throwError } from 'rxjs';
import { SmsService } from './sms.service';

function createService(overrides: Record<string, unknown> = {}) {
  const configValues: Record<string, unknown> = {
    'sms.bmsEnabled': true,
    'sms.bmsApiKey': 'super-secret-key',
    'sms.bmsBaseUrl': 'https://api.mnotify.com/api',
    'sms.bmsSenderId': 'BloodSOS',
    'sms.bmsTimeoutMs': 15000,
    'sms.bmsMaxRecipients': 100,
    'sms.bmsRetryAttempts': 1,
    ...overrides,
  };
  const config = { get: jest.fn((key: string, fallback?: unknown) => configValues[key] ?? fallback) };
  const http: any = {
    post: jest.fn(() =>
      of({
        data: {
          status: 'success',
          code: '2000',
          message: 'messages sent successfully',
          summary: {
            _id: 'provider-campaign-1',
            total_sent: 2,
            contacts: 2,
            total_rejected: 0,
            credit_used: 2,
            credit_left: 6,
          },
        },
      }),
    ),
  };
  const prisma: any = {
    smsLog: {
      findUnique: jest.fn(async () => null),
      create: jest.fn(async (args: any) => ({ id: 'sms-log-1', ...args.data })),
      update: jest.fn(async (args: any) => ({ id: args.where.id, ...args.data })),
      count: jest.fn(async () => 0),
      findMany: jest.fn(async () => []),
    },
  };
  return { service: new SmsService(config as any, http as any, prisma as any), config, http, prisma };
}

describe('SmsService BMS/mNotify provider integration', () => {
  it('normalizes Ghana phone numbers and removes duplicates', () => {
    const { service } = createService();

    expect(service.normalizeRecipients(['0241234567', '+233241234567', '233541234567', '241234567', 'bad-number'])).toEqual({
      valid: ['0241234567', '0541234567'],
      invalidCount: 1,
    });
  });

  it('accepts working appointment SMS phone formats used by stored donor records', () => {
    const { service } = createService();

    expect(service.normalizeGhanaPhone('544515775')).toBe('0544515775');
    expect(service.normalizeGhanaPhone('0544515775')).toBe('0544515775');
    expect(service.normalizeGhanaPhone('233544515775')).toBe('0544515775');
    expect(service.normalizeGhanaPhone('+233544515775')).toBe('0544515775');
    expect(service.normalizeGhanaPhone('+2330544515775')).toBe('0544515775');
    expect(service.normalizeGhanaPhone('2330544515775')).toBe('0544515775');
  });

  it('builds the correct provider endpoint and payload without returning the API key', async () => {
    const { service, http } = createService();

    const result = await service.sendBulkSms({
      recipients: ['0241234567', '0541234567'],
      message: 'BloodSOS test message',
      purpose: SmsPurpose.TEST,
      relatedEntityType: 'SMS_TEST',
      relatedEntityId: 'test-1',
    });

    expect(http.post).toHaveBeenCalledWith(
      'https://api.mnotify.com/api/sms/quick?key=super-secret-key',
      {
        recipient: ['0241234567', '0541234567'],
        sender: 'BloodSOS',
        message: 'BloodSOS test message',
        is_schedule: false,
        schedule_date: '',
      },
      { timeout: 15000 },
    );
    expect(result).toMatchObject({
      success: true,
      status: SmsStatus.SENT,
      providerCampaignId: 'provider-campaign-1',
      sentCount: 2,
      rejectedCount: 0,
      creditUsed: 2,
      creditLeft: 6,
    });
    expect(JSON.stringify(result)).not.toContain('super-secret-key');
  });

  it('skips malformed recipients and records a safe failure when none are valid', async () => {
    const { service, http, prisma } = createService();

    const result = await service.sendBulkSms({
      recipients: ['not-a-phone'],
      message: 'BloodSOS test message',
      purpose: SmsPurpose.TEST,
      relatedEntityType: 'SMS_TEST',
      relatedEntityId: 'test-2',
    });

    expect(http.post).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      success: false,
      errorCode: 'NO_VALID_RECIPIENTS',
      skippedInvalidRecipients: 1,
    });
    expect(prisma.smsLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ errorCode: 'NO_VALID_RECIPIENTS' }),
      }),
    );
  });

  it('handles provider rejection without exposing secrets', async () => {
    const { service, http } = createService();
    http.post.mockReturnValueOnce(
      of({
        data: {
          status: 'error',
          code: '4001',
          message: 'insufficient credit',
        },
      }),
    );

    const result = await service.sendBulkSms({
      recipients: ['0241234567'],
      message: 'BloodSOS test message',
      purpose: SmsPurpose.TEST,
      relatedEntityType: 'SMS_TEST',
      relatedEntityId: 'test-3',
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('INSUFFICIENT_CREDIT');
    expect(JSON.stringify(result)).not.toContain('super-secret-key');
  });

  it('retries transient provider failures only', async () => {
    const { service, http } = createService();
    http.post
      .mockReturnValueOnce(throwError(() => ({ isAxiosError: true, response: { status: 503 } })))
      .mockReturnValueOnce(
        of({
          data: {
            status: 'success',
            code: '2000',
            message: 'messages sent successfully',
            summary: { _id: 'retry-campaign', total_sent: 1, contacts: 1, total_rejected: 0 },
          },
        }),
      );

    const result = await service.sendBulkSms({
      recipients: ['0241234567'],
      message: 'BloodSOS retry message',
      purpose: SmsPurpose.TEST,
      relatedEntityType: 'SMS_TEST',
      relatedEntityId: 'test-4',
    });

    expect(http.post).toHaveBeenCalledTimes(2);
    expect(result.providerCampaignId).toBe('retry-campaign');
  });

  it('suppresses successful duplicate sends using the idempotency key', async () => {
    const { service, http, prisma } = createService();
    prisma.smsLog.findUnique.mockResolvedValueOnce({
      id: 'existing-log',
      status: SmsStatus.SENT,
      recipientCount: 1,
      sentCount: 1,
      rejectedCount: 0,
      providerCampaignId: 'existing-provider-id',
      creditUsed: 1,
      creditLeft: 5,
      providerCode: '2000',
      providerMessage: 'messages sent successfully',
    });

    const result = await service.sendBulkSms({
      recipients: ['0241234567'],
      message: 'BloodSOS duplicate message',
      purpose: SmsPurpose.APPOINTMENT_CREATED,
      relatedEntityType: 'APPOINTMENT',
      relatedEntityId: 'appointment-1',
      idempotencyKey: 'appointment-1-created-024',
    });

    expect(http.post).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      success: true,
      errorCode: 'DUPLICATE_SUPPRESSED',
      providerCampaignId: 'existing-provider-id',
    });
  });

  it('rejects overlong messages before provider delivery', async () => {
    const { service } = createService();

    await expect(
      service.sendBulkSms({
        recipients: ['0241234567'],
        message: 'x'.repeat(1000),
        purpose: SmsPurpose.TEST,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
