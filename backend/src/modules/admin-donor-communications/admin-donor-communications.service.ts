import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BloodGroup,
  DonorClinicalStatus,
  Prisma,
  Role,
  SmsCampaignRecipientStatus,
  SmsCampaignStatus,
  SmsPurpose,
  SmsSelectionMode,
} from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { SmsService } from '../sms/sms.service';
import { DEFAULT_BMS_SENDER_ID } from '../sms/sms.constants';
import { EXPORT_FIELD_LABELS, EXPORT_FIELDS, ExportField } from './admin-donor-communications.constants';
import {
  DonorCommunicationFilters,
  DonorContactsQueryDto,
  ExportDonorContactsDto,
  LaunchSmsCampaignDto,
  PreviewBulkSmsDto,
} from './dto/donor-communications.dto';

type DonorContact = Prisma.DonorGetPayload<{
  include: {
    user: { select: { id: true; email: true; isActive: true; role: true } };
    preferredHospital: { select: { id: true; hospitalName: true } };
    clinicalRecords: { select: { status: true } };
  };
}>;

@Injectable()
export class AdminDonorCommunicationsService {
  private readonly logger = new Logger(AdminDonorCommunicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly smsService: SmsService,
    private readonly config: ConfigService,
  ) {}

  assertAdmin(role: Role) {
    const adminRoles: Role[] = [Role.ADMIN];
    if (!adminRoles.includes(role)) {
      throw new ForbiddenException('Only platform administrators can access donor communications.');
    }
  }

  async listDonors(user: { id: string; role: Role }, query: DonorContactsQueryDto) {
    this.assertAdmin(user.role);
    const skip = Math.max(0, Number(query.skip ?? 0));
    const take = Math.min(Math.max(1, Number(query.take ?? 25)), 100);
    const where = this.buildWhere(query);
    const [total, items, summaryDonors] = await Promise.all([
      this.prisma.donor.count({ where }),
      this.prisma.donor.findMany({
        where,
        include: this.include,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.donor.findMany({
        where,
        select: {
          id: true,
          phone: true,
          alternativePhoneNumber: true,
          notificationSmsEnabled: true,
          user: { select: { isActive: true } },
          clinicalRecords: { select: { status: true } },
        },
        take: this.exportMaxRows,
      }),
    ]);
    const validPhoneNumbers = new Set<string>();
    let smsEnabledCount = 0;
    let excludedCount = 0;
    summaryDonors.forEach((donor) => {
      const permanentlyDeferred = donor.clinicalRecords.some((record) => record.status === DonorClinicalStatus.PERMANENTLY_DEFERRED);
      const validPhone = this.normalizeDonorPhone(donor);
      if (donor.notificationSmsEnabled) smsEnabledCount += 1;
      if (donor.notificationSmsEnabled && donor.user.isActive && !permanentlyDeferred && validPhone) {
        validPhoneNumbers.add(validPhone);
      } else {
        excludedCount += 1;
      }
    });
    await this.audit.log('DONOR_CONTACTS_VIEWED', 'DONOR', user.id, undefined, {
      filters: this.safeFilters(query),
      total,
      skip,
      take,
    }, 'Admin viewed donor communications contacts.', { module: 'DONOR_COMMUNICATIONS' });
    return {
      items: items.map((donor) => this.toSafeDonor(donor)),
      total,
      skip,
      take,
      summary: {
        smsEnabledCount,
        validPhoneCount: validPhoneNumbers.size,
        excludedCount,
      },
    };
  }

  async exportContacts(user: { id: string; role: Role }, dto: ExportDonorContactsDto, ipAddress?: string) {
    this.assertAdmin(user.role);
    const fields = this.validateFields(dto.fields);
    const donors = await this.resolveDonors(dto, this.exportMaxRows);
    if (donors.length > this.exportMaxRows) {
      throw new BadRequestException(`Export is limited to ${this.exportMaxRows} donors.`);
    }
    const csv = this.buildCsv(donors, fields);
    await this.audit.log('DONOR_CONTACTS_EXPORTED', 'DONOR', user.id, undefined, {
      selectionMode: dto.donorIds?.length ? 'EXPLICIT' : 'FILTERED',
      filters: this.safeFilters(dto.filters),
      donorCount: donors.length,
      fields,
      exportedAt: new Date().toISOString(),
    }, 'Admin exported donor contact CSV.', { module: 'DONOR_COMMUNICATIONS', ipAddress });
    return {
      filename: `bloodsos-donor-contacts-${new Date().toISOString().slice(0, 10)}.csv`,
      contentType: 'text/csv; charset=utf-8',
      content: `\uFEFF${csv}`,
      count: donors.length,
    };
  }

  async previewSms(user: { id: string; role: Role }, dto: PreviewBulkSmsDto) {
    this.assertAdmin(user.role);
    const message = this.validateMessage(dto.message);
    const donors = await this.resolveSelection(dto, this.campaignMaxRecipients);
    const analysis = this.analyzeRecipients(donors);
    await this.audit.log('SMS_CAMPAIGN_PREVIEWED', 'SMS_CAMPAIGN', user.id, undefined, {
      selectionMode: dto.selectionMode,
      filters: this.safeFilters(dto.filters),
      requestedDonors: donors.length,
      eligibleRecipients: analysis.eligible.length,
      excluded: analysis.excluded,
      messageLength: message.length,
      estimatedSmsParts: this.estimateSmsParts(message),
    }, 'Admin previewed a donor SMS campaign.', { module: 'DONOR_COMMUNICATIONS' });
    return {
      requestedDonors: donors.length,
      eligibleRecipients: analysis.eligible.length,
      excluded: analysis.excluded,
      estimatedCredits: analysis.eligible.length * this.estimateSmsParts(message),
      messageLength: message.length,
      estimatedSmsParts: this.estimateSmsParts(message),
      sampleRecipients: analysis.eligible.slice(0, 5).map((item) => ({
        donorName: item.donor.fullName,
        maskedPhone: this.maskPhone(item.normalizedPhone),
      })),
    };
  }

  async launchCampaign(user: { id: string; role: Role }, dto: LaunchSmsCampaignDto, ipAddress?: string) {
    this.assertAdmin(user.role);
    if (dto.confirmationText !== 'SEND') {
      throw new BadRequestException('Type SEND to confirm this SMS campaign.');
    }
    const message = this.validateMessage(dto.message);
    const donors = await this.resolveSelection(dto, this.campaignMaxRecipients);
    const analysis = this.analyzeRecipients(donors);
    if (analysis.eligible.length === 0) {
      throw new BadRequestException('No eligible SMS recipients match this campaign.');
    }
    if (analysis.eligible.length > this.campaignMaxRecipients) {
      throw new BadRequestException(`SMS campaigns are limited to ${this.campaignMaxRecipients} recipients.`);
    }

    const startedAt = new Date();
    const campaign = await this.prisma.smsCampaign.create({
      data: {
        name: dto.name.trim(),
        message,
        senderId: DEFAULT_BMS_SENDER_ID,
        status: SmsCampaignStatus.PROCESSING,
        createdById: user.id,
        selectionMode: dto.selectionMode as SmsSelectionMode,
        filtersJson: dto.selectionMode === 'FILTERED' ? (this.safeFilters(dto.filters) as Prisma.InputJsonObject) : Prisma.JsonNull,
        requestedDonorCount: donors.length,
        eligibleRecipientCount: analysis.eligible.length,
        skippedCount: analysis.skippedTotal,
        startedAt,
      },
    });

    await this.prisma.smsCampaignRecipient.createMany({
      data: [
        ...analysis.eligible.map((item) => ({
          campaignId: campaign.id,
          donorId: item.donor.id,
          maskedPhone: this.maskPhone(item.normalizedPhone),
          status: SmsCampaignRecipientStatus.PENDING,
        })),
        ...analysis.skipped.map((item) => ({
          campaignId: campaign.id,
          donorId: item.donor.id,
          maskedPhone: item.maskedPhone,
          status: SmsCampaignRecipientStatus.SKIPPED,
          skipReason: item.reason,
        })),
      ],
    });

    let sent = 0;
    let failed = 0;
    let creditUsed = 0;
    const providerCampaignIds: string[] = [];
    const batchSize = Math.max(1, Math.min(this.campaignBatchSize, this.bmsMaxRecipients));
    const batches = this.chunk(analysis.eligible, batchSize);

    for (const [index, batch] of batches.entries()) {
      const result = await this.smsService.sendBulkSms({
        recipients: batch.map((item) => item.normalizedPhone),
        message,
        purpose: SmsPurpose.DONOR_MOBILIZATION,
        triggeredByUserId: user.id,
        relatedEntityType: 'SMS_CAMPAIGN',
        relatedEntityId: campaign.id,
        idempotencyKey: `${campaign.id}:batch:${index}`,
      });
      if (result.providerCampaignId) providerCampaignIds.push(result.providerCampaignId);
      creditUsed += Number(result.creditUsed ?? result.sentCount * this.estimateSmsParts(message));
      if (result.success) {
        sent += result.sentCount;
        failed += Math.max(0, batch.length - result.sentCount);
        await this.prisma.smsCampaignRecipient.updateMany({
          where: { campaignId: campaign.id, donorId: { in: batch.map((item) => item.donor.id) } },
          data: { status: SmsCampaignRecipientStatus.SENT, smsLogId: result.smsLogId ?? null },
        });
      } else {
        failed += batch.length;
        await this.prisma.smsCampaignRecipient.updateMany({
          where: { campaignId: campaign.id, donorId: { in: batch.map((item) => item.donor.id) } },
          data: { status: SmsCampaignRecipientStatus.FAILED, skipReason: result.errorCode ?? 'SMS_FAILED', smsLogId: result.smsLogId ?? null },
        });
      }
    }

    const status = sent === analysis.eligible.length
      ? SmsCampaignStatus.COMPLETED
      : sent > 0
        ? SmsCampaignStatus.PARTIALLY_COMPLETED
        : SmsCampaignStatus.FAILED;
    const completed = await this.prisma.smsCampaign.update({
      where: { id: campaign.id },
      data: {
        status,
        sentCount: sent,
        failedCount: failed,
        skippedCount: analysis.skippedTotal,
        creditUsed,
        providerCampaignIdsJson: providerCampaignIds as Prisma.InputJsonArray,
        completedAt: new Date(),
      },
    });
    await this.audit.log(
      status === SmsCampaignStatus.FAILED ? 'SMS_CAMPAIGN_FAILED' : 'SMS_CAMPAIGN_COMPLETED',
      'SMS_CAMPAIGN',
      user.id,
      campaign.id,
      {
        campaignId: campaign.id,
        requestedDonors: donors.length,
        eligibleRecipients: analysis.eligible.length,
        sent,
        failed,
        skipped: analysis.skippedTotal,
        creditUsed,
        batchCount: batches.length,
      },
      'Admin donor SMS campaign finished.',
      { module: 'DONOR_COMMUNICATIONS', ipAddress },
    );
    return {
      campaignId: campaign.id,
      status: completed.status,
      requestedDonors: donors.length,
      eligibleRecipients: analysis.eligible.length,
      sent,
      failed,
      skipped: analysis.skippedTotal,
      creditUsed,
    };
  }

  async listCampaigns(user: { id: string; role: Role }, query: Record<string, string | undefined>) {
    this.assertAdmin(user.role);
    const skip = Math.max(0, Number(query.skip ?? 0));
    const take = Math.min(Math.max(1, Number(query.take ?? 20)), 100);
    const where: Prisma.SmsCampaignWhereInput = {
      ...(query.status ? { status: query.status as SmsCampaignStatus } : {}),
      ...(query.createdBy ? { createdById: query.createdBy } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
      ...((query.dateFrom || query.dateTo)
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.smsCampaign.count({ where }),
      this.prisma.smsCampaign.findMany({
        where,
        include: { createdBy: { select: { id: true, email: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);
    return { total, skip, take, items: items.map((item) => ({ ...item, message: this.preview(item.message) })) };
  }

  async getCampaign(user: { id: string; role: Role }, id: string) {
    this.assertAdmin(user.role);
    const campaign = await this.prisma.smsCampaign.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, email: true, role: true } },
        recipients: { select: { status: true, skipReason: true } },
      },
    });
    if (!campaign) throw new BadRequestException('SMS campaign not found.');
    const skipReasonSummary = this.countBy(campaign.recipients.map((item) => item.skipReason).filter(Boolean) as string[]);
    const statusSummary = this.countBy(campaign.recipients.map((item) => item.status));
    return {
      ...campaign,
      message: this.preview(campaign.message),
      recipients: undefined,
      skipReasonSummary,
      statusSummary,
    };
  }

  private buildWhere(filters?: DonorCommunicationFilters): Prisma.DonorWhereInput {
    const bloodGroup = this.normalizeBloodGroup(filters?.bloodGroup);
    const lastDonationFrom = filters?.lastDonationFrom ? new Date(filters.lastDonationFrom) : null;
    const lastDonationTo = filters?.lastDonationTo ? new Date(filters.lastDonationTo) : null;
    return {
      ...(filters?.search
        ? {
            OR: [
              { fullName: { contains: filters.search, mode: 'insensitive' } },
              { phone: { contains: filters.search, mode: 'insensitive' } },
              { alternativePhoneNumber: { contains: filters.search, mode: 'insensitive' } },
              { user: { email: { contains: filters.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
      ...(bloodGroup ? { bloodGroup } : {}),
      ...(filters?.region ? { region: { contains: filters.region, mode: 'insensitive' } } : {}),
      ...(filters?.city ? { city: { contains: filters.city, mode: 'insensitive' } } : {}),
      ...(filters?.hospitalId ? { preferredHospitalId: filters.hospitalId } : {}),
      ...(filters?.eligibilityStatus === 'APPROVED' ? { eligibilityStatus: true } : {}),
      ...(filters?.eligibilityStatus === 'PENDING' ? { eligibilityStatus: false } : {}),
      ...(filters?.accountStatus === 'ACTIVE' ? { user: { isActive: true } } : {}),
      ...(filters?.accountStatus === 'INACTIVE' ? { user: { isActive: false } } : {}),
      ...(this.toBool(filters?.smsEnabled) === true ? { notificationSmsEnabled: true } : {}),
      ...(this.toBool(filters?.smsEnabled) === false ? { notificationSmsEnabled: false } : {}),
      ...(this.toBool(filters?.neverDonated) ? { lastDonationDate: null } : {}),
      ...(this.toBool(filters?.reminderDue) ? { nextEligibilityDate: { lte: new Date() } } : {}),
      ...((lastDonationFrom || lastDonationTo)
        ? {
            lastDonationDate: {
              ...(lastDonationFrom && !Number.isNaN(lastDonationFrom.getTime()) ? { gte: lastDonationFrom } : {}),
              ...(lastDonationTo && !Number.isNaN(lastDonationTo.getTime()) ? { lte: lastDonationTo } : {}),
            },
          }
        : {}),
    };
  }

  private async resolveDonors(dto: { donorIds?: string[]; filters?: DonorCommunicationFilters }, take: number) {
    const where: Prisma.DonorWhereInput = dto.donorIds?.length
      ? { id: { in: [...new Set(dto.donorIds)] } }
      : this.buildWhere(dto.filters);
    return this.prisma.donor.findMany({
      where,
      include: this.include,
      orderBy: { createdAt: 'desc' },
      take: Math.min(take + 1, this.exportMaxRows + 1),
    });
  }

  private async resolveSelection(dto: PreviewBulkSmsDto, max: number) {
    if (dto.selectionMode === 'EXPLICIT' && !dto.donorIds?.length) {
      throw new BadRequestException('Select at least one donor before previewing SMS.');
    }
    const donors = await this.resolveDonors(
      dto.selectionMode === 'EXPLICIT' ? { donorIds: dto.donorIds } : { filters: dto.filters },
      max + 1,
    );
    if (donors.length > max) {
      throw new BadRequestException(`SMS campaign selection is limited to ${max} donors.`);
    }
    return donors;
  }

  private analyzeRecipients(donors: DonorContact[]) {
    const seenPhones = new Set<string>();
    const excluded = {
      smsDisabled: 0,
      invalidPhone: 0,
      inactiveAccount: 0,
      duplicatePhone: 0,
      permanentlyDeferred: 0,
    };
    const eligible: Array<{ donor: DonorContact; normalizedPhone: string }> = [];
    const skipped: Array<{ donor: DonorContact; reason: string; maskedPhone: string | null }> = [];
    donors.forEach((donor) => {
      const normalizedPhone = this.normalizeDonorPhone(donor);
      const permanentlyDeferred = donor.clinicalRecords.some((record) => record.status === DonorClinicalStatus.PERMANENTLY_DEFERRED);
      const reject = (reason: keyof typeof excluded, maskedPhone = normalizedPhone ? this.maskPhone(normalizedPhone) : null) => {
        excluded[reason] += 1;
        skipped.push({ donor, reason, maskedPhone });
      };
      if (!donor.user.isActive) return reject('inactiveAccount');
      if (permanentlyDeferred) return reject('permanentlyDeferred');
      if (!donor.notificationSmsEnabled) return reject('smsDisabled');
      if (!normalizedPhone) return reject('invalidPhone');
      if (seenPhones.has(normalizedPhone)) return reject('duplicatePhone', this.maskPhone(normalizedPhone));
      seenPhones.add(normalizedPhone);
      eligible.push({ donor, normalizedPhone });
    });
    return {
      eligible,
      skipped,
      excluded,
      skippedTotal: skipped.length,
    };
  }

  private toSafeDonor(donor: DonorContact) {
    const normalizedPhone = this.normalizeDonorPhone(donor);
    return {
      id: donor.id,
      donorNumber: donor.donorNumber,
      fullName: donor.fullName,
      bloodGroup: donor.bloodGroup,
      region: donor.region,
      city: donor.city,
      maskedPhone: normalizedPhone ? this.maskPhone(normalizedPhone) : 'Unavailable',
      maskedEmail: this.maskEmail(donor.user.email),
      eligibilityStatus: donor.eligibilityStatus ? 'Approved' : 'Pending',
      accountStatus: donor.user.isActive ? 'Active' : 'Inactive',
      lastDonationDate: donor.lastDonationDate,
      smsEnabled: donor.notificationSmsEnabled,
      preferredHospital: donor.preferredHospital?.hospitalName ?? null,
    };
  }

  private buildCsv(donors: DonorContact[], fields: ExportField[]) {
    const rows = [fields.map((field) => EXPORT_FIELD_LABELS[field])];
    donors.forEach((donor) => {
      rows.push(fields.map((field) => this.csvValue(this.fieldValue(donor, field))));
    });
    return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  }

  private fieldValue(donor: DonorContact, field: ExportField) {
    switch (field) {
      case 'name': return donor.fullName;
      case 'phone': return this.normalizeDonorPhone(donor) ?? '';
      case 'email': return donor.user.email;
      case 'bloodGroup': return donor.bloodGroup;
      case 'region': return donor.region ?? '';
      case 'city': return donor.city ?? '';
      case 'hospital': return donor.preferredHospital?.hospitalName ?? '';
      case 'lastDonationDate': return donor.lastDonationDate?.toISOString().slice(0, 10) ?? '';
      case 'eligibilityStatus': return donor.eligibilityStatus ? 'Approved' : 'Pending';
      default: return '';
    }
  }

  private csvValue(value: unknown) {
    const raw = String(value ?? '');
    return /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  }

  private normalizeDonorPhone(donor: Pick<DonorContact, 'id' | 'phone' | 'alternativePhoneNumber'> & Record<string, unknown>) {
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

  private buildPhoneCandidates(donor: Pick<DonorContact, 'phone' | 'alternativePhoneNumber'> & Record<string, unknown>) {
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
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) return null;
    const phoneDigits = trimmedPhone.replace(/^\+/, '').replace(/\D/g, '');
    const countryDigits = countryCode.trim().replace(/^\+/, '').replace(/\D/g, '');
    if (!countryDigits) return trimmedPhone;
    if (trimmedPhone.startsWith('+') || phoneDigits.startsWith(countryDigits) || phoneDigits.startsWith('0')) {
      return trimmedPhone;
    }
    return `+${countryDigits}${phoneDigits}`;
  }

  private stringOrNull(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private logPhoneDiagnostic(
    donor: Pick<DonorContact, 'id' | 'phone' | 'alternativePhoneNumber'> & Record<string, unknown>,
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
      event: 'DONOR_COMMUNICATIONS_PHONE_DIAGNOSTIC',
      donorId: donor.id,
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

  private validateFields(fields: string[]) {
    if (!fields?.length) throw new BadRequestException('Select at least one export field.');
    const allowed = new Set<string>(EXPORT_FIELDS);
    const valid = fields.filter((field): field is ExportField => allowed.has(field));
    if (valid.length !== fields.length) throw new BadRequestException('One or more export fields are not allowed.');
    return valid;
  }

  private validateMessage(message: string) {
    const trimmed = message?.trim();
    if (!trimmed) throw new BadRequestException('SMS message cannot be blank.');
    if (trimmed.length > this.messageMaxLength) {
      throw new BadRequestException(`SMS message cannot exceed ${this.messageMaxLength} characters.`);
    }
    return trimmed;
  }

  private estimateSmsParts(message: string) {
    return message.length <= 160 ? 1 : Math.ceil(message.length / 153);
  }

  private normalizeBloodGroup(value?: string) {
    if (!value) return undefined;
    const aliases: Record<string, BloodGroup> = {
      O_POSITIVE: BloodGroup.O_POS,
      O_NEGATIVE: BloodGroup.O_NEG,
      A_POSITIVE: BloodGroup.A_POS,
      A_NEGATIVE: BloodGroup.A_NEG,
      B_POSITIVE: BloodGroup.B_POS,
      B_NEGATIVE: BloodGroup.B_NEG,
      AB_POSITIVE: BloodGroup.AB_POS,
      AB_NEGATIVE: BloodGroup.AB_NEG,
    };
    return aliases[value] ?? (Object.values(BloodGroup).includes(value as BloodGroup) ? value as BloodGroup : undefined);
  }

  private safeFilters(filters?: DonorCommunicationFilters) {
    return Object.fromEntries(Object.entries(filters ?? {}).filter(([, value]) => value !== undefined && value !== ''));
  }

  private toBool(value: unknown) {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return undefined;
  }

  private maskPhone(phone: string) {
    return phone.length <= 5 ? '***' : `${phone.slice(0, 3)}***${phone.slice(-4)}`;
  }

  private maskEmail(email: string) {
    const [name, domain] = email.split('@');
    return `${name.slice(0, 2)}***@${domain ?? 'unknown'}`;
  }

  private preview(message: string) {
    return message.length > 160 ? `${message.slice(0, 157)}...` : message;
  }

  private countBy(values: string[]) {
    return values.reduce<Record<string, number>>((acc, value) => {
      acc[value] = (acc[value] ?? 0) + 1;
      return acc;
    }, {});
  }

  private chunk<T>(items: T[], size: number) {
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
      chunks.push(items.slice(index, index + size));
    }
    return chunks;
  }

  private get include() {
    return {
      user: { select: { id: true, email: true, isActive: true, role: true } },
      preferredHospital: { select: { id: true, hospitalName: true } },
      clinicalRecords: { select: { status: true } },
    } satisfies Prisma.DonorInclude;
  }

  private get exportMaxRows() {
    return this.config.get<number>('sms.donorContactExportMaxRows', 5000);
  }

  private get campaignMaxRecipients() {
    return this.config.get<number>('sms.smsCampaignMaxRecipients', 1000);
  }

  private get campaignBatchSize() {
    return this.config.get<number>('sms.smsCampaignBatchSize', 100);
  }

  private get messageMaxLength() {
    return this.config.get<number>('sms.smsCampaignMessageMaxLength', 480);
  }

  private get bmsMaxRecipients() {
    return this.config.get<number>('sms.bmsMaxRecipients', 100);
  }
}
