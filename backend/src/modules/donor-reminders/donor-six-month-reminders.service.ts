import { ForbiddenException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DonorClinicalStatus, Prisma, Role, SmsPurpose } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../prisma.service';
import { SmsService } from '../sms/sms.service';

export const SIX_MONTH_REMINDER_TYPE = 'SIX_MONTH_DONATION_ENCOURAGEMENT';
export const SIX_MONTH_TEST_REMINDER_TYPE = 'SIX_MONTH_DONATION_ENCOURAGEMENT_TEST';
export const SIX_MONTH_REMINDER_MESSAGE =
  "BloodSOS: It's been about 6 months since your last donation. Your next donation could save a life. Log in to review your status and book a donation if you're available.";
export const SIX_MONTH_TEST_REMINDER_MESSAGE =
  "BloodSOS TEST: It's been about 6 months since your last donation. Your next donation could save a life. Log in to review your status and book a donation if you're available.";

type ReminderDonor = Prisma.DonorGetPayload<{
  include: {
    user: { select: { id: true; email: true; isActive: true; role: true } };
    clinicalRecords: { select: { status: true } };
    donationHistory: { orderBy: { donatedAt: 'desc' }; take: 1 };
    reminderLogs: { where: { reminderType: string }; select: { reminderType: true; dueDate: true; status: true } };
  };
}>;

type ResolvedReminderRecipient = {
  donor: ReminderDonor;
  normalizedPhone: string;
  dueDate: Date;
  latestDonationDate: Date;
};

@Injectable()
export class DonorSixMonthRemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DonorSixMonthRemindersService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly smsService: SmsService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (!this.enabled) return;
    this.scheduleNextRun();
  }

  onModuleDestroy() {
    if (this.timer) clearTimeout(this.timer);
  }

  async preview(user: { id: string; role: Role }, donorId?: string) {
    this.assertAdmin(user.role);
    const resolution = await this.resolveRecipients({ donorId });
    await this.audit.log('DONOR_SIX_MONTH_REMINDER_PREVIEWED', 'DONOR_REMINDER', user.id, undefined, {
      donorId: donorId ?? null,
      dueDonors: resolution.dueDonors,
      eligibleRecipients: resolution.eligible.length,
      excluded: resolution.excluded,
      estimatedCredits: this.calculateSmsMetrics(this.buildMessage(), resolution.eligible.length).estimatedCredits,
      months: this.months,
    }, 'Admin previewed six-month donor encouragement reminders.', { module: 'DONOR_REMINDERS' });
    return this.toPreviewResponse(resolution);
  }

  async sendTest(user: { id: string; role: Role }, donorId: string, confirmSend: boolean) {
    this.assertAdmin(user.role);
    const resolution = await this.resolveRecipients({
      donorId,
      ignoreDueDate: true,
      ignorePreviousReminder: true,
      allowMissingDonationForTest: true,
    });
    const recipient = resolution.eligible[0];
    if (!recipient) {
      await this.audit.log('DONOR_SIX_MONTH_REMINDER_TEST_PREVIEWED', 'DONOR_REMINDER', user.id, donorId, {
        eligibleRecipients: 0,
        excluded: resolution.excluded,
      }, 'Admin previewed a six-month reminder test but no eligible recipient was available.', { module: 'DONOR_REMINDERS' });
      return { ...this.toPreviewResponse(resolution), requiresConfirmation: true, smsSent: false };
    }

    if (!confirmSend) {
      await this.audit.log('DONOR_SIX_MONTH_REMINDER_TEST_PREVIEWED', 'DONOR_REMINDER', user.id, donorId, {
        eligibleRecipients: 1,
        estimatedCredits: 1,
      }, 'Admin previewed a one-recipient six-month reminder test.', { module: 'DONOR_REMINDERS' });
      return { ...this.toPreviewResponse(resolution), requiresConfirmation: true, smsSent: false };
    }

    const message = this.buildMessage({ test: true });
    const smsMetrics = this.calculateSmsMetrics(message, 1);
    const result = await this.smsService.sendBulkSms({
      recipients: [recipient.normalizedPhone],
      message,
      purpose: SmsPurpose.DONOR_SIX_MONTH_REMINDER,
      triggeredByUserId: user.id,
      relatedEntityType: 'DONOR_REMINDER_TEST',
      relatedEntityId: donorId,
      idempotencyKey: `donor-six-month-test:${donorId}:${new Date().toISOString().slice(0, 10)}:${user.id}`,
    });
    const status = result.success ? 'TEST_SENT' : 'FAILED';
    await this.prisma.donorReminderLog.create({
      data: {
        donorId,
        reminderType: SIX_MONTH_TEST_REMINDER_TYPE,
        dueDate: new Date(),
        status,
        sentAt: result.success ? new Date() : null,
        providerCampaignId: result.providerCampaignId ?? null,
        smsLogId: result.smsLogId ?? null,
        failureReason: result.success ? null : result.errorCode ?? 'SMS_FAILED',
        triggeredByUserId: user.id,
      },
    });
    await this.audit.log(result.success ? 'DONOR_SIX_MONTH_REMINDER_TEST_SENT' : 'DONOR_SIX_MONTH_REMINDER_TEST_FAILED', 'DONOR_REMINDER', user.id, donorId, {
      smsLogId: result.smsLogId ?? null,
      status: result.status,
      sentCount: result.sentCount,
      errorCode: result.errorCode ?? null,
    }, 'Admin executed a controlled one-recipient six-month reminder test.', { module: 'DONOR_REMINDERS' });
    return {
      smsSent: result.success,
      donorId,
      maskedPhone: this.maskPhone(recipient.normalizedPhone),
      message,
      smsMetrics,
      sentCount: result.sentCount,
      status: result.status,
      smsLogId: result.smsLogId ?? null,
      errorCode: result.errorCode ?? null,
      errorMessage: result.errorMessage ?? null,
    };
  }

  async runDueReminders() {
    if (!this.enabled) return { enabled: false, sent: 0, failed: 0 };
    await this.audit.log('DONOR_SIX_MONTH_REMINDER_JOB_STARTED', 'DONOR_REMINDER', undefined, undefined, {
      months: this.months,
      timezone: this.timezone,
      cron: this.cron,
    }, 'Six-month donor reminder job started.', { module: 'DONOR_REMINDERS' });
    const resolution = await this.resolveRecipients();
    let sent = 0;
    let failed = 0;
    for (const recipient of resolution.eligible) {
      const log = await this.createPendingRealReminderLog(recipient);
      if (!log) continue;
      const result = await this.smsService.sendBulkSms({
        recipients: [recipient.normalizedPhone],
        message: this.buildMessage(),
        purpose: SmsPurpose.DONOR_SIX_MONTH_REMINDER,
        relatedEntityType: 'DONOR_REMINDER',
        relatedEntityId: log.id,
        idempotencyKey: `donor-six-month:${recipient.donor.id}:${recipient.dueDate.toISOString().slice(0, 10)}`,
      });
      if (result.success) {
        sent += 1;
        await this.prisma.donorReminderLog.update({
          where: { id: log.id },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            providerCampaignId: result.providerCampaignId ?? null,
            smsLogId: result.smsLogId ?? null,
          },
        });
      } else {
        failed += 1;
        await this.prisma.donorReminderLog.update({
          where: { id: log.id },
          data: {
            status: 'FAILED',
            smsLogId: result.smsLogId ?? null,
            failureReason: result.errorCode ?? 'SMS_FAILED',
          },
        });
      }
      await this.audit.log(result.success ? 'DONOR_SIX_MONTH_REMINDER_SENT' : 'DONOR_SIX_MONTH_REMINDER_FAILED', 'DONOR_REMINDER', undefined, log.id, {
        donorId: recipient.donor.id,
        dueDate: recipient.dueDate.toISOString(),
        smsLogId: result.smsLogId ?? null,
        errorCode: result.errorCode ?? null,
      }, 'Six-month donor encouragement reminder processed.', { module: 'DONOR_REMINDERS' });
    }
    return { enabled: true, dueDonors: resolution.dueDonors, eligibleRecipients: resolution.eligible.length, sent, failed, excluded: resolution.excluded };
  }

  async resolveRecipients(options: { donorId?: string; ignoreDueDate?: boolean; ignorePreviousReminder?: boolean; allowMissingDonationForTest?: boolean } = {}) {
    const todayEnd = this.endOfLocalDay(new Date(), this.timezone);
    const donors = await this.prisma.donor.findMany({
      where: {
        ...(options.donorId ? { id: options.donorId } : {}),
        ...(!options.donorId ? { donationHistory: { some: {} } } : {}),
      },
      include: this.includeForReminder(),
      take: options.donorId ? undefined : 5000,
    });
    const seenPhones = new Set<string>();
    const excluded = {
      notDue: 0,
      inactiveAccount: 0,
      smsDisabled: 0,
      invalidPhone: 0,
      permanentlyDeferred: 0,
      ineligible: 0,
      duplicatePhone: 0,
      alreadyReminded: 0,
      noCompletedDonation: 0,
    };
    const eligible: ResolvedReminderRecipient[] = [];
    let dueDonors = 0;

    for (const donor of donors) {
      const latestDonation = donor.donationHistory[0];
      if (!latestDonation) {
        if (!options.allowMissingDonationForTest) {
          excluded.noCompletedDonation += 1;
          continue;
        }
      }
      const dueDate = latestDonation
        ? this.startOfLocalDay(this.addCalendarMonths(latestDonation.donatedAt, this.months), this.timezone)
        : this.startOfLocalDay(new Date(), this.timezone);
      if (!options.ignoreDueDate && dueDate > todayEnd) {
        excluded.notDue += 1;
        continue;
      }
      dueDonors += 1;
      if (!donor.user.isActive) {
        excluded.inactiveAccount += 1;
        continue;
      }
      if (!donor.notificationSmsEnabled) {
        excluded.smsDisabled += 1;
        continue;
      }
      if (!donor.eligibilityStatus) {
        excluded.ineligible += 1;
        continue;
      }
      if (donor.clinicalRecords.some((record) => record.status === DonorClinicalStatus.PERMANENTLY_DEFERRED)) {
        excluded.permanentlyDeferred += 1;
        continue;
      }
      if (!options.ignorePreviousReminder && donor.reminderLogs.some((log) => log.reminderType === SIX_MONTH_REMINDER_TYPE && log.dueDate.getTime() === dueDate.getTime() && ['PENDING', 'SENT'].includes(log.status))) {
        excluded.alreadyReminded += 1;
        continue;
      }
      const normalizedPhone = this.normalizeDonorPhone(donor);
      if (!normalizedPhone) {
        excluded.invalidPhone += 1;
        continue;
      }
      if (seenPhones.has(normalizedPhone)) {
        excluded.duplicatePhone += 1;
        continue;
      }
      seenPhones.add(normalizedPhone);
      eligible.push({ donor, normalizedPhone, dueDate, latestDonationDate: latestDonation?.donatedAt ?? dueDate });
    }
    return { dueDonors, eligible, excluded, evaluatedDonors: donors.length };
  }

  private async createPendingRealReminderLog(recipient: ResolvedReminderRecipient) {
    try {
      return await this.prisma.donorReminderLog.create({
        data: {
          donorId: recipient.donor.id,
          reminderType: SIX_MONTH_REMINDER_TYPE,
          dueDate: recipient.dueDate,
          status: 'PENDING',
        },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) return null;
      throw error;
    }
  }

  private normalizeDonorPhone(donor: Pick<ReminderDonor, 'id' | 'phone' | 'alternativePhoneNumber'> & Record<string, unknown>) {
    const candidates = this.buildPhoneCandidates(donor);
    for (const candidate of candidates) {
      const normalized = this.smsService.normalizeGhanaPhone(candidate);
      if (normalized) {
        this.logPhoneDiagnostic(donor, candidates, true);
        return normalized;
      }
    }
    this.logPhoneDiagnostic(donor, candidates, false);
    return null;
  }

  private buildPhoneCandidates(donor: Pick<ReminderDonor, 'phone' | 'alternativePhoneNumber'> & Record<string, unknown>) {
    const primaryPhone = this.stringOrNull(donor.phone);
    const alternativePhone = this.stringOrNull(donor.alternativePhoneNumber);
    const primaryCountryCode = this.stringOrNull(donor.countryCode) ?? this.stringOrNull(donor.phoneCountryCode) ?? this.stringOrNull(donor.primaryPhoneCode);
    const alternativeCountryCode =
      this.stringOrNull(donor.alternativeCountryCode) ??
      this.stringOrNull(donor.alternativePhoneCountryCode) ??
      this.stringOrNull(donor.alternativePhoneCode);
    const values = [
      primaryPhone,
      this.combineCountryCode(primaryCountryCode, primaryPhone),
      alternativePhone,
      this.combineCountryCode(alternativeCountryCode, alternativePhone),
    ];
    return [...new Set(values.filter((value): value is string => Boolean(value)))];
  }

  private combineCountryCode(countryCode?: string | null, phone?: string | null) {
    if (!countryCode || !phone) return null;
    const phoneDigits = phone.trim().replace(/^\+/, '').replace(/\D/g, '');
    const countryDigits = countryCode.trim().replace(/^\+/, '').replace(/\D/g, '');
    if (!countryDigits || !phoneDigits) return phone;
    if (phone.trim().startsWith('+') || phoneDigits.startsWith(countryDigits) || phoneDigits.startsWith('0')) return phone;
    return `+${countryDigits}${phoneDigits}`;
  }

  buildMessage(options: { test?: boolean } = {}) {
    return options.test ? SIX_MONTH_TEST_REMINDER_MESSAGE : SIX_MONTH_REMINDER_MESSAGE;
  }

  calculateSmsMetrics(message: string, recipients = 1) {
    const encoding = this.isGsm7(message) ? 'GSM-7' : 'Unicode';
    const singleSegmentLimit = encoding === 'GSM-7' ? 160 : 70;
    const multipartSegmentLimit = encoding === 'GSM-7' ? 153 : 67;
    const segments = message.length <= singleSegmentLimit
      ? 1
      : Math.ceil(message.length / multipartSegmentLimit);
    return {
      characterCount: message.length,
      encoding,
      segments,
      estimatedCredits: segments * recipients,
    };
  }

  private isGsm7(message: string) {
    const gsmBasic =
      '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ' +
      ' !"#¤%&\'()*+,-./0123456789:;<=>?' +
      '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
    const gsmExtension = '^{}\\[~]|€';
    for (const char of message) {
      if (!gsmBasic.includes(char) && !gsmExtension.includes(char)) return false;
    }
    return true;
  }

  private toPreviewResponse(resolution: Awaited<ReturnType<DonorSixMonthRemindersService['resolveRecipients']>>) {
    return {
      evaluatedDonors: resolution.evaluatedDonors,
      dueDonors: resolution.dueDonors,
      eligibleRecipients: resolution.eligible.length,
      excluded: resolution.excluded,
      estimatedCredits: this.calculateSmsMetrics(this.buildMessage(), resolution.eligible.length).estimatedCredits,
      testEstimatedCredits: this.calculateSmsMetrics(this.buildMessage({ test: true }), resolution.eligible.length).estimatedCredits,
      messagePreview: this.buildMessage(),
      testMessagePreview: this.buildMessage({ test: true }),
      smsMetrics: this.calculateSmsMetrics(this.buildMessage(), Math.max(1, resolution.eligible.length)),
      testSmsMetrics: this.calculateSmsMetrics(this.buildMessage({ test: true }), Math.max(1, resolution.eligible.length)),
      sampleRecipients: resolution.eligible.slice(0, 5).map((item) => ({
        donorId: item.donor.id,
        donorName: item.donor.fullName,
        bloodGroup: item.donor.bloodGroup,
        maskedPhone: this.maskPhone(item.normalizedPhone),
        lastDonationDate: item.latestDonationDate.toISOString(),
        reminderDueDate: item.dueDate.toISOString(),
      })),
    };
  }

  addCalendarMonths(date: Date, months: number) {
    const result = new Date(date);
    const originalDay = result.getUTCDate();
    result.setUTCDate(1);
    result.setUTCMonth(result.getUTCMonth() + months);
    const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
    result.setUTCDate(Math.min(originalDay, lastDay));
    return result;
  }

  startOfLocalDay(date: Date, timezone: string) {
    const parts = this.localParts(date, timezone);
    return this.zonedTimeToUtc(parts.year, parts.month, parts.day, 0, 0, 0, timezone);
  }

  private endOfLocalDay(date: Date, timezone: string) {
    const start = this.startOfLocalDay(date, timezone);
    return new Date(start.getTime() + 24 * 60 * 60_000 - 1);
  }

  private scheduleNextRun() {
    const next = this.nextConfiguredRun(new Date());
    const delayMs = Math.max(1_000, next.getTime() - Date.now());
    this.timer = setTimeout(async () => {
      try {
        await this.runDueReminders();
      } catch (error) {
        this.logger.error('Six-month donor reminder job failed.', error as Error);
        await this.audit.log('DONOR_SIX_MONTH_REMINDER_JOB_FAILED', 'DONOR_REMINDER', undefined, undefined, {
          error: error instanceof Error ? error.message : 'Unknown error',
        }, 'Six-month donor reminder job failed.', { module: 'DONOR_REMINDERS' });
      } finally {
        this.scheduleNextRun();
      }
    }, delayMs);
    this.logger.log(`Six-month donor reminder job scheduled for ${next.toISOString()} (${this.timezone}, ${this.cron}).`);
  }

  nextConfiguredRun(from: Date) {
    const [minuteRaw, hourRaw] = this.cron.split(/\s+/);
    const minute = Number(minuteRaw);
    const hour = Number(hourRaw);
    if (!Number.isInteger(minute) || !Number.isInteger(hour) || minute < 0 || minute > 59 || hour < 0 || hour > 23) {
      this.logger.warn(`Unsupported reminder cron "${this.cron}". Falling back to 08:00 daily.`);
      return this.nextDailyRun(from, 8, 0);
    }
    return this.nextDailyRun(from, hour, minute);
  }

  private nextDailyRun(from: Date, hour: number, minute: number) {
    const parts = this.localParts(from, this.timezone);
    let candidate = this.zonedTimeToUtc(parts.year, parts.month, parts.day, hour, minute, 0, this.timezone);
    if (candidate <= from) {
      const tomorrow = new Date(candidate.getTime() + 24 * 60 * 60_000);
      const tomorrowParts = this.localParts(tomorrow, this.timezone);
      candidate = this.zonedTimeToUtc(tomorrowParts.year, tomorrowParts.month, tomorrowParts.day, hour, minute, 0, this.timezone);
    }
    return candidate;
  }

  private localParts(date: Date, timezone: string) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
  }

  private zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, second: number, timezone: string) {
    const utc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    const parts = this.localParts(utc, timezone);
    const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
    return new Date(utc.getTime() - (localAsUtc - desiredAsUtc));
  }

  private logPhoneDiagnostic(
    donor: Pick<ReminderDonor, 'id' | 'phone' | 'alternativePhoneNumber'> & Record<string, unknown>,
    candidates: string[],
    normalized: boolean,
  ) {
    if (process.env.NODE_ENV === 'production') return;
    const primaryCountryCode = this.stringOrNull(donor.countryCode) ?? this.stringOrNull(donor.phoneCountryCode) ?? this.stringOrNull(donor.primaryPhoneCode);
    const alternativeCountryCode =
      this.stringOrNull(donor.alternativeCountryCode) ??
      this.stringOrNull(donor.alternativePhoneCountryCode) ??
      this.stringOrNull(donor.alternativePhoneCode);
    this.logger.debug({
      event: 'DONOR_SIX_MONTH_REMINDER_PHONE_DIAGNOSTIC',
      primaryPhoneExists: Boolean(donor.phone),
      alternativePhoneExists: Boolean(donor.alternativePhoneNumber),
      primaryCountryCodeExists: Boolean(primaryCountryCode),
      alternativeCountryCodeExists: Boolean(alternativeCountryCode),
      primaryPhoneLength: this.stringOrNull(donor.phone)?.length ?? 0,
      alternativePhoneLength: this.stringOrNull(donor.alternativePhoneNumber)?.length ?? 0,
      primaryCountryCodeLength: primaryCountryCode?.length ?? 0,
      alternativeCountryCodeLength: alternativeCountryCode?.length ?? 0,
      candidateCount: candidates.length,
      candidateLengths: candidates.map((candidate) => candidate.length),
      normalizationSucceeded: normalized,
    });
  }

  private includeForReminder() {
    return {
      user: { select: { id: true, email: true, isActive: true, role: true } },
      clinicalRecords: { select: { status: true } },
      donationHistory: { orderBy: { donatedAt: 'desc' }, take: 1 },
      reminderLogs: { where: { reminderType: SIX_MONTH_REMINDER_TYPE }, select: { reminderType: true, dueDate: true, status: true } },
    } satisfies Prisma.DonorInclude;
  }

  private assertAdmin(role: Role) {
    if (role !== Role.ADMIN) throw new ForbiddenException('Only platform administrators can manage donor reminder SMS.');
  }

  private stringOrNull(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private maskPhone(phone: string) {
    return phone.length <= 5 ? '***' : `${phone.slice(0, 3)}***${phone.slice(-4)}`;
  }

  private isUniqueViolation(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private get enabled() {
    return this.config.get<boolean>('donorSixMonthReminder.enabled', false);
  }

  private get cron() {
    return this.config.get<string>('donorSixMonthReminder.cron', '0 8 * * *');
  }

  private get timezone() {
    return this.config.get<string>('donorSixMonthReminder.timezone', 'Africa/Accra');
  }

  private get months() {
    return Math.max(1, this.config.get<number>('donorSixMonthReminder.months', 6));
  }
}
