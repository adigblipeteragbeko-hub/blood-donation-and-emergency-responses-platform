import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { createHash } from 'crypto';
import { SmsPurpose, SmsStatus } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import {
  BMS_PROVIDER_NAME,
  BMS_SUCCESS_CODE,
  DEFAULT_BMS_BASE_URL,
  DEFAULT_BMS_SENDER_ID,
  DEFAULT_SMS_MAX_RECIPIENTS,
  DEFAULT_SMS_RETRY_ATTEMPTS,
  DEFAULT_SMS_TIMEOUT_MS,
} from './sms.constants';
import { BmsQuickSmsResponse, SmsErrorCode, SmsSendInput, SmsSendResult } from './sms.types';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  async sendSms(input: Omit<SmsSendInput, 'recipients'> & { recipient: string | null | undefined }) {
    return this.sendBulkSms({ ...input, recipients: [input.recipient] });
  }

  async sendBulkSms(input: SmsSendInput): Promise<SmsSendResult> {
    const normalized = this.normalizeRecipients(input.recipients);
    const senderId = this.senderId;
    const message = input.message.trim();
    const requestedRecipients = input.recipients.filter((recipient) => Boolean(recipient?.trim())).length;
    const idempotencyKey = input.idempotencyKey ?? this.buildIdempotencyKey(input.purpose, normalized.valid, input.relatedEntityType, input.relatedEntityId, message);

    if (!message) {
      throw new BadRequestException('SMS message is required.');
    }

    const segments = this.countSegments(message);
    if (segments > 6) {
      throw new BadRequestException('SMS message is too long. Keep it within six SMS segments.');
    }

    if (normalized.valid.length > this.maxRecipients) {
      throw new BadRequestException(`SMS recipient batch limit exceeded. Maximum is ${this.maxRecipients}.`);
    }

    const duplicate = idempotencyKey
      ? await this.prisma.smsLog.findUnique({ where: { idempotencyKey } })
      : null;
    const duplicateSuppressionStatuses: SmsStatus[] = [SmsStatus.SENT, SmsStatus.PARTIAL, SmsStatus.PENDING];
    if (duplicate && duplicateSuppressionStatuses.includes(duplicate.status)) {
      return {
        success: duplicate.status !== SmsStatus.PENDING,
        status: duplicate.status,
        provider: BMS_PROVIDER_NAME,
        providerCampaignId: duplicate.providerCampaignId,
        requestedRecipients,
        validRecipients: duplicate.recipientCount,
        sentCount: duplicate.sentCount,
        rejectedCount: duplicate.rejectedCount,
        skippedInvalidRecipients: normalized.invalidCount,
        creditUsed: duplicate.creditUsed,
        creditLeft: duplicate.creditLeft,
        providerCode: duplicate.providerCode,
        providerMessage: duplicate.providerMessage,
        errorCode: 'DUPLICATE_SUPPRESSED',
        errorMessage: 'A matching SMS event was already processed.',
        smsLogId: duplicate.id,
      };
    }

    const smsLog = await this.prisma.smsLog.create({
      data: {
        purpose: input.purpose,
        status: SmsStatus.PENDING,
        recipientCount: normalized.valid.length,
        senderId,
        messagePreview: this.preview(input.messagePreviewOverride ?? message),
        hospitalId: input.hospitalId ?? null,
        triggeredByUserId: input.triggeredByUserId ?? null,
        relatedEntityType: input.relatedEntityType ?? null,
        relatedEntityId: input.relatedEntityId ?? null,
        idempotencyKey,
      },
    });

    if (!this.enabled) {
      return this.failLog(smsLog.id, {
        code: 'SMS_DISABLED',
        message: 'SMS delivery is disabled.',
        requestedRecipients,
        validRecipients: normalized.valid.length,
        skippedInvalidRecipients: normalized.invalidCount,
      });
    }

    if (!this.apiKey || !senderId) {
      return this.failLog(smsLog.id, {
        code: 'SMS_NOT_CONFIGURED',
        message: 'SMS provider credentials are not configured.',
        requestedRecipients,
        validRecipients: normalized.valid.length,
        skippedInvalidRecipients: normalized.invalidCount,
      });
    }

    if (normalized.valid.length === 0) {
      return this.failLog(smsLog.id, {
        code: 'NO_VALID_RECIPIENTS',
        message: 'No valid SMS recipients were provided.',
        requestedRecipients,
        validRecipients: 0,
        skippedInvalidRecipients: normalized.invalidCount,
      });
    }

    try {
      const providerResponse = await this.sendWithRetry(normalized.valid, senderId, message);
      const parsed = this.parseProviderResponse(providerResponse, normalized.valid.length);
      const status = parsed.sentCount > 0 && parsed.rejectedCount === 0
        ? SmsStatus.SENT
        : parsed.sentCount > 0
          ? SmsStatus.PARTIAL
          : SmsStatus.REJECTED;

      const updated = await this.prisma.smsLog.update({
        where: { id: smsLog.id },
        data: {
          status,
          sentCount: parsed.sentCount,
          rejectedCount: parsed.rejectedCount,
          providerCampaignId: parsed.providerCampaignId,
          providerCode: parsed.providerCode,
          providerMessage: parsed.providerMessage,
          creditUsed: parsed.creditUsed,
          creditLeft: parsed.creditLeft,
          sentAt: new Date(),
          attemptCount: parsed.attemptCount,
        },
      });

      return {
        success: status === SmsStatus.SENT || status === SmsStatus.PARTIAL,
        status,
        provider: BMS_PROVIDER_NAME,
        providerCampaignId: updated.providerCampaignId,
        requestedRecipients,
        validRecipients: normalized.valid.length,
        sentCount: updated.sentCount,
        rejectedCount: updated.rejectedCount,
        skippedInvalidRecipients: normalized.invalidCount,
        creditUsed: updated.creditUsed,
        creditLeft: updated.creditLeft,
        providerCode: updated.providerCode,
        providerMessage: updated.providerMessage,
        smsLogId: updated.id,
      };
    } catch (error) {
      const providerError = this.toProviderError(error);
      this.logger.warn(
        `SMS ${input.purpose} failed for ${normalized.valid.length} recipient(s): ${providerError.code}`,
      );
      return this.failLog(smsLog.id, {
        code: providerError.code,
        message: providerError.message,
        requestedRecipients,
        validRecipients: normalized.valid.length,
        skippedInvalidRecipients: normalized.invalidCount,
        providerCode: providerError.providerCode,
      });
    }
  }

  sendEmergencyDonorAlert(input: Omit<SmsSendInput, 'purpose'>) {
    return this.sendBulkSms({ ...input, purpose: SmsPurpose.EMERGENCY_REQUEST });
  }

  sendAppointmentNotification(input: Omit<SmsSendInput, 'purpose'> & { purpose?: SmsPurpose }) {
    return this.sendBulkSms({ ...input, purpose: input.purpose ?? SmsPurpose.APPOINTMENT_CREATED });
  }

  sendEligibilityNotification(input: Omit<SmsSendInput, 'purpose'> & { approved: boolean }) {
    return this.sendBulkSms({
      ...input,
      purpose: input.approved ? SmsPurpose.ELIGIBILITY_APPROVED : SmsPurpose.ELIGIBILITY_REJECTED,
    });
  }

  async getHistory(query: { skip?: number; take?: number; purpose?: SmsPurpose; status?: SmsStatus }) {
    const take = Math.min(Number(query.take ?? 25), 100);
    const skip = Number(query.skip ?? 0);
    const where = {
      ...(query.purpose ? { purpose: query.purpose } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.smsLog.count({ where }),
      this.prisma.smsLog.findMany({
        where,
        include: {
          triggeredBy: { select: { id: true, email: true, role: true } },
          hospital: { select: { id: true, hospitalName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);
    return { total, items };
  }

  normalizeRecipients(recipients: Array<string | null | undefined>) {
    const unique = new Set<string>();
    let invalidCount = 0;
    recipients.forEach((recipient) => {
      const normalized = this.normalizeGhanaPhone(recipient);
      if (!normalized) {
        invalidCount += 1;
        return;
      }
      unique.add(normalized);
    });
    return { valid: [...unique], invalidCount };
  }

  normalizeGhanaPhone(phone?: string | null) {
    if (!phone) return null;
    const digits = phone.trim().replace(/^\+/, '').replace(/\D/g, '');
    if (/^[235]\d{8}$/.test(digits)) return `0${digits}`;
    if (/^0[235]\d{8}$/.test(digits)) return digits;
    if (/^233[235]\d{8}$/.test(digits)) return `0${digits.slice(3)}`;
    if (/^2330[235]\d{8}$/.test(digits)) return `0${digits.slice(4)}`;
    return null;
  }

  buildEventIdempotencyKey(purpose: SmsPurpose, relatedEntityType: string, relatedEntityId: string, eventState: string, recipients: string[]) {
    const normalized = this.normalizeRecipients(recipients).valid;
    return this.buildIdempotencyKey(purpose, normalized, relatedEntityType, relatedEntityId, eventState);
  }

  private buildIdempotencyKey(
    purpose: SmsPurpose,
    recipients: string[],
    relatedEntityType?: string | null,
    relatedEntityId?: string | null,
    eventState?: string | null,
  ) {
    if (!relatedEntityType || !relatedEntityId || recipients.length === 0) return null;
    const digest = createHash('sha256')
      .update([purpose, relatedEntityType, relatedEntityId, eventState ?? '', ...recipients.sort()].join('|'))
      .digest('hex');
    return digest;
  }

  private async sendWithRetry(recipients: string[], senderId: string, message: string) {
    const attempts = Math.max(1, this.retryAttempts + 1);
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const response = await firstValueFrom(
          this.httpService.post<BmsQuickSmsResponse>(
            `${this.baseUrl}/sms/quick?key=${encodeURIComponent(this.apiKey)}`,
            {
              recipient: recipients,
              sender: senderId,
              message,
              is_schedule: false,
              schedule_date: '',
            },
            { timeout: this.timeoutMs },
          ),
        );
        return { ...response.data, attemptCount: attempt };
      } catch (error) {
        lastError = error;
        if (!this.isTransient(error) || attempt === attempts) break;
        await this.delay(250 * 2 ** (attempt - 1));
      }
    }

    throw lastError;
  }

  private parseProviderResponse(response: (BmsQuickSmsResponse & { attemptCount?: number }) | null | undefined, requestedCount: number) {
    if (!response || typeof response !== 'object') {
      throw { code: 'UNKNOWN_PROVIDER_RESPONSE', message: 'SMS provider returned an unexpected response.' };
    }
    if (response.status !== 'success' || response.code !== BMS_SUCCESS_CODE) {
      throw {
        code: this.mapProviderCode(response.code, response.message),
        message: response.message || 'SMS provider rejected the request.',
        providerCode: response.code,
      };
    }
    const summary = response.summary;
    if (!summary || typeof summary !== 'object') {
      throw { code: 'UNKNOWN_PROVIDER_RESPONSE', message: 'SMS provider response did not include a valid summary.' };
    }
    return {
      providerCampaignId: summary._id ?? null,
      sentCount: Number(summary.total_sent ?? requestedCount),
      rejectedCount: Number(summary.total_rejected ?? 0),
      creditUsed: summary.credit_used ?? null,
      creditLeft: summary.credit_left ?? null,
      providerCode: response.code ?? null,
      providerMessage: response.message ?? null,
      attemptCount: response.attemptCount ?? 1,
    };
  }

  private async failLog(
    smsLogId: string,
    input: {
      code: SmsErrorCode;
      message: string;
      requestedRecipients: number;
      validRecipients: number;
      skippedInvalidRecipients: number;
      providerCode?: string | null;
    },
  ): Promise<SmsSendResult> {
    const updated = await this.prisma.smsLog.update({
      where: { id: smsLogId },
      data: {
        status: input.code === 'NO_VALID_RECIPIENTS' ? SmsStatus.REJECTED : SmsStatus.FAILED,
        rejectedCount: input.validRecipients,
        errorCode: input.code,
        errorMessage: this.safeError(input.message),
        providerCode: input.providerCode ?? null,
        providerMessage: this.safeError(input.message),
        attemptCount: 1,
      },
    });
    return {
      success: false,
      status: updated.status,
      provider: BMS_PROVIDER_NAME,
      providerCampaignId: updated.providerCampaignId,
      requestedRecipients: input.requestedRecipients,
      validRecipients: input.validRecipients,
      sentCount: updated.sentCount,
      rejectedCount: updated.rejectedCount,
      skippedInvalidRecipients: input.skippedInvalidRecipients,
      providerCode: updated.providerCode,
      providerMessage: updated.providerMessage,
      errorCode: input.code,
      errorMessage: updated.errorMessage,
      smsLogId: updated.id,
    };
  }

  private toProviderError(error: unknown): { code: SmsErrorCode; message: string; providerCode?: string | null } {
    if (this.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        return { code: 'PROVIDER_TIMEOUT', message: 'SMS provider request timed out.' };
      }
      const status = error.response?.status;
      if (status && status >= 500) {
        return { code: 'PROVIDER_UNAVAILABLE', message: 'SMS provider is temporarily unavailable.' };
      }
      const providerBody = error.response?.data as Partial<BmsQuickSmsResponse> | undefined;
      return {
        code: this.mapProviderCode(providerBody?.code, providerBody?.message),
        message: providerBody?.message || 'SMS provider rejected the request.',
        providerCode: providerBody?.code,
      };
    }
    const typed = error as { code?: SmsErrorCode; message?: string; providerCode?: string | null };
    return {
      code: typed.code ?? 'UNKNOWN_PROVIDER_RESPONSE',
      message: typed.message ?? 'SMS provider returned an unexpected response.',
      providerCode: typed.providerCode,
    };
  }

  private isAxiosError(error: unknown): error is AxiosError {
    return typeof error === 'object' && error !== null && 'isAxiosError' in error;
  }

  private isTransient(error: unknown) {
    if (!this.isAxiosError(error)) return false;
    if (error.code === 'ECONNABORTED' || error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') return true;
    const status = error.response?.status ?? 0;
    return status >= 500;
  }

  private mapProviderCode(code?: string | null, message?: string | null): SmsErrorCode {
    const text = `${code ?? ''} ${message ?? ''}`.toLowerCase();
    if (text.includes('credit')) return 'INSUFFICIENT_CREDIT';
    if (text.includes('sender')) return 'INVALID_SENDER_ID';
    if (text.includes('recipient') || text.includes('phone')) return 'INVALID_RECIPIENT';
    return 'PROVIDER_REJECTED';
  }

  private preview(message: string) {
    return message.length > 160 ? `${message.slice(0, 157)}...` : message;
  }

  private safeError(message: string) {
    return (this.apiKey ? message.replace(this.apiKey, '[redacted]') : message).slice(0, 500);
  }

  private countSegments(message: string) {
    if (message.length <= 160) return 1;
    return Math.ceil(message.length / 153);
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private get enabled() {
    return this.config.get<boolean>('sms.bmsEnabled', false);
  }

  private get apiKey() {
    return this.config.get<string>('sms.bmsApiKey', '');
  }

  private get baseUrl() {
    return this.config.get<string>('sms.bmsBaseUrl', DEFAULT_BMS_BASE_URL).replace(/\/$/, '');
  }

  private get senderId() {
    return this.config.get<string>('sms.bmsSenderId', DEFAULT_BMS_SENDER_ID);
  }

  private get timeoutMs() {
    return this.config.get<number>('sms.bmsTimeoutMs', DEFAULT_SMS_TIMEOUT_MS);
  }

  private get maxRecipients() {
    return this.config.get<number>('sms.bmsMaxRecipients', DEFAULT_SMS_MAX_RECIPIENTS);
  }

  private get retryAttempts() {
    return this.config.get<number>('sms.bmsRetryAttempts', DEFAULT_SMS_RETRY_ATTEMPTS);
  }
}
