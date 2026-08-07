import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DonorClinicalStatus, Role } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { ActivityService } from '../../common/activity/activity.service';
import { PrismaService } from '../../prisma.service';
import {
  HealthAnswerDto,
  OfficeUseDto,
  ReviewQueueQueryDto,
  UpdateClinicalReviewDto,
  UpsertDonorClinicalDraftDto,
} from './dto/donor-clinical-record.dto';

const STAFF_ROLES = new Set<Role>([
  Role.HOSPITAL_ADMIN,
  Role.HOSPITAL_ADMIN,
  Role.ADMIN,
  Role.ADMIN,
]);

const PLATFORM_REVIEW_ROLES: Role[] = [Role.ADMIN];

const RISK_YES_KEYS = new Set([
  'q2','q3','q4','q5','q6','q7','q8','q9','q10','q12','q13','q14','q15','q16','q17','q18','q19','q20','q21','q22',
]);

const DOCUMENT_TYPES = new Set(['Ghana Card', 'Passport', "Driver's License", 'Voter ID', 'NHIS', 'Other']);

function normalizeDocumentNumber(idType?: string | null, idNumber?: string | null) {
  const type = String(idType ?? '').trim();
  const raw = String(idNumber ?? '').trim();
  if (!raw) return raw;
  if (type === 'Ghana Card') return raw.toUpperCase();
  if (['Passport', "Driver's License", 'Voter ID', 'NHIS'].includes(type)) return raw.toUpperCase().replace(/\s+/g, '');
  return raw.replace(/\s+/g, ' ');
}

function validateDocumentNumber(idType?: string | null, idNumber?: string | null) {
  const type = String(idType ?? '').trim();
  const value = normalizeDocumentNumber(type, idNumber);
  if (!type && !value) return value;
  if (!DOCUMENT_TYPES.has(type)) {
    throw new BadRequestException('Select a supported identity document type.');
  }
  if (!value) {
    throw new BadRequestException('Enter the selected identity document number.');
  }
  if (type === 'Ghana Card' && !/^GHA-[0-9]{9}-[0-9]$/.test(value)) {
    throw new BadRequestException('Enter a valid Ghana Card format, for example GHA-123456789-0. This checks format only and does not verify authenticity.');
  }
  if (['Passport', "Driver's License", 'Voter ID', 'NHIS'].includes(type) && !/^[A-Z0-9-]{5,20}$/.test(value)) {
    throw new BadRequestException(`${type} numbers should use 5 to 20 letters or numbers. Hyphens are allowed where printed on the document.`);
  }
  if (type === 'Other' && !/^[A-Za-z0-9 -]{3,30}$/.test(value)) {
    throw new BadRequestException('Document numbers should use 3 to 30 letters, numbers, spaces, or hyphens.');
  }
  return value;
}

function maskDocumentNumber(value?: string | null) {
  const text = String(value ?? '').trim();
  if (!text) return text;
  if (text.length <= 4) return '****';
  return `${text.slice(0, 3)}****${text.slice(-2)}`;
}

@Injectable()
export class DonorClinicalRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly activity: ActivityService,
  ) {}

  private date(value?: string | null) {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private json(value: unknown) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  private redactClinicalAuditValue(value: unknown): unknown {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map((item) => this.redactClinicalAuditValue(item));
    const source = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(source).map(([key, entry]) => [
        key,
        key === 'idNumber' ? maskDocumentNumber(String(entry ?? '')) : this.redactClinicalAuditValue(entry),
      ]),
    );
  }

  private async donorForUser(userId: string) {
    const donor = await this.prisma.donor.findUnique({ where: { userId }, include: { user: true } });
    if (!donor) throw new NotFoundException('Donor profile not found');
    return donor;
  }

  private async assertStaffAccess(user: { id: string; role: Role }, recordId?: string) {
    if (!STAFF_ROLES.has(user.role)) throw new ForbiddenException('Clinical review access is restricted.');
    if (!recordId || PLATFORM_REVIEW_ROLES.includes(user.role)) return;

    const record = await this.prisma.donorClinicalRecord.findUnique({
      where: { id: recordId },
      select: {
        selectedHospitalId: true,
        selectedHospital: { select: { userId: true } },
      },
    });
    if (record?.selectedHospitalId && record.selectedHospital?.userId !== user.id) {
      throw new ForbiddenException('You can only review records submitted to your hospital.');
    }
  }

  private async snapshot(recordId: string, actorUserId: string | undefined, reason: string) {
    const record = await this.prisma.donorClinicalRecord.findUnique({
      where: { id: recordId },
      include: { healthAnswers: true, clinicalReview: true },
    });
    if (!record) return;
    await this.prisma.donorClinicalFormVersion.create({
      data: {
        clinicalRecordId: recordId,
        version: record.version,
        snapshot: this.json(record) as object,
        changeReason: reason,
        createdById: actorUserId,
      },
    });
  }

  private async clinicalAudit(recordId: string, actorUserId: string | undefined, action: string, description: string, oldValue?: unknown, newValue?: unknown) {
    const safeOldValue = this.redactClinicalAuditValue(oldValue);
    const safeNewValue = this.redactClinicalAuditValue(newValue);
    await this.prisma.donorClinicalAuditTrail.create({
      data: {
        clinicalRecordId: recordId,
        actorUserId,
        action,
        description,
        oldValue: this.json(safeOldValue) as object,
        newValue: this.json(safeNewValue) as object,
      },
    });
    await this.audit.log(action, 'DONOR_CLINICAL_RECORD', actorUserId, recordId, this.json(safeNewValue), description, {
      module: 'DONOR_CLINICAL_RECORDS',
      oldValue: this.json(safeOldValue),
      newValue: this.json(safeNewValue),
    });
  }

  private recordPayload(dto: UpsertDonorClinicalDraftDto) {
    const idNumber = dto.idType || dto.idNumber ? validateDocumentNumber(dto.idType, dto.idNumber) : dto.idNumber;
    return {
      selectedHospitalId: dto.selectedHospitalId,
      formDate: this.date(dto.formDate) ?? new Date(),
      venue: dto.venue,
      title: dto.title,
      firstName: dto.firstName,
      otherNames: dto.otherNames,
      lastName: dto.lastName,
      dateOfBirth: this.date(dto.dateOfBirth),
      sex: dto.sex,
      areaOfResidence: dto.areaOfResidence,
      addressOrWorkplace: dto.addressOrWorkplace,
      occupation: dto.occupation,
      idType: dto.idType,
      idNumber,
      phoneNumber: dto.phoneNumber,
      email: dto.email,
      preferredContactMethod: dto.preferredContactMethod,
      doNotContactForDonation: dto.doNotContactForDonation ?? false,
      donorType: dto.donorType ?? 'VOLUNTARY',
      hasDonatedBefore: dto.hasDonatedBefore,
      lastDonationDate: dto.hasDonatedBefore === false ? null : this.date(dto.lastDonationDate),
      numberOfVoluntaryDonations: dto.hasDonatedBefore === false ? 0 : dto.numberOfVoluntaryDonations ?? 0,
      numberOfReplacementDonations: dto.numberOfReplacementDonations ?? 0,
      donorCardNumber: dto.hasDonatedBefore === false ? '' : dto.donorCardNumber,
      patientName: dto.patientName,
      patientHospital: dto.patientHospital,
      requestReference: dto.requestReference?.trim() || null,
      ward: dto.ward,
      relationshipToPatient: dto.relationshipToPatient,
      clerkingOfficerName: dto.clerkingOfficerName,
      clerkingOfficerSignature: dto.clerkingOfficerSignature,
      declarationConfirmed: dto.declarationConfirmed ?? false,
      testingConsent: dto.testingConsent ?? false,
      contactConsent: dto.contactConsent ?? false,
      staffEligibilityConsent: dto.staffEligibilityConsent ?? false,
      dataUseConsent: dto.dataUseConsent ?? false,
      declarationDate: this.date(dto.declarationDate),
    };
  }

  private riskForAnswers(answers: HealthAnswerDto[] = []) {
    const risky = answers.filter((answer) => answer.answer && RISK_YES_KEYS.has(answer.questionKey));
    return {
      donorRiskFlag: risky.length > 0,
      donorRiskSummary: risky.length ? risky.map((a) => `${a.questionKey}: ${a.questionText}`).join('\n') : null,
    };
  }

  private includeAll = {
    donor: { include: { user: { select: { id: true, email: true, role: true } } } },
    selectedHospital: true,
    reviewer: { select: { id: true, email: true, role: true } },
    healthAnswers: { orderBy: { questionKey: 'asc' as const } },
    clinicalReview: true,
    auditTrails: { orderBy: { createdAt: 'desc' as const }, take: 20, include: { actor: { select: { email: true, role: true } } } },
  };

  async saveDraft(userId: string, dto: UpsertDonorClinicalDraftDto) {
    const donor = await this.donorForUser(userId);
    const latest = await this.prisma.donorClinicalRecord.findFirst({ where: { donorId: donor.id }, orderBy: { createdAt: 'desc' } });
    if (latest && latest.status !== DonorClinicalStatus.DRAFT) {
      throw new BadRequestException('Submitted clinical records are locked. Create an amendment through hospital review.');
    }

    const risk = this.riskForAnswers(dto.healthAnswers);
    const data = { ...this.recordPayload(dto), ...risk };
    const record = latest
      ? await this.prisma.donorClinicalRecord.update({ where: { id: latest.id }, data })
      : await this.prisma.donorClinicalRecord.create({ data: { donorId: donor.id, ...data } });

    if (dto.healthAnswers) await this.replaceAnswers(record.id, dto.healthAnswers);
    await this.clinicalAudit(record.id, userId, 'DONOR_CLINICAL_DRAFT_SAVED', 'Donor saved clinical eligibility draft.', undefined, dto);
    return this.getById(record.id, { id: userId, role: Role.DONOR });
  }

  async updateDraft(userId: string, id: string, dto: UpsertDonorClinicalDraftDto) {
    const donor = await this.donorForUser(userId);
    const existing = await this.prisma.donorClinicalRecord.findUnique({ where: { id } });
    if (!existing || existing.donorId !== donor.id) throw new NotFoundException('Clinical record not found');
    if (existing.status !== DonorClinicalStatus.DRAFT) throw new BadRequestException('Only draft records can be edited by donors.');
    await this.snapshot(id, userId, 'Draft edited');
    const risk = this.riskForAnswers(dto.healthAnswers);
    await this.prisma.donorClinicalRecord.update({ where: { id }, data: { ...this.recordPayload(dto), ...risk, version: { increment: 1 } } });
    if (dto.healthAnswers) await this.replaceAnswers(id, dto.healthAnswers);
    await this.clinicalAudit(id, userId, 'DONOR_CLINICAL_DRAFT_UPDATED', 'Donor updated clinical eligibility draft.', existing, dto);
    return this.getById(id, { id: userId, role: Role.DONOR });
  }

  private async replaceAnswers(recordId: string, answers: HealthAnswerDto[]) {
    await this.prisma.$transaction([
      this.prisma.donorClinicalHealthAnswer.deleteMany({ where: { clinicalRecordId: recordId } }),
      this.prisma.donorClinicalHealthAnswer.createMany({
        data: answers.map((answer) => ({
          clinicalRecordId: recordId,
          questionKey: answer.questionKey,
          questionText: answer.questionText,
          answer: answer.answer,
          details: answer.details,
          riskFlag: answer.answer && RISK_YES_KEYS.has(answer.questionKey),
        })),
      }),
    ]);
  }

  private validateSubmission(record: any) {
    const required = ['selectedHospitalId', 'firstName', 'lastName', 'dateOfBirth', 'sex', 'areaOfResidence', 'idType', 'idNumber', 'phoneNumber', 'email'];
    const missing = required.filter((key) => !record[key]);
    if (missing.length) throw new BadRequestException(`Missing required clinical fields: ${missing.join(', ')}`);
    if (!record.declarationConfirmed || !record.testingConsent || !record.contactConsent || !record.staffEligibilityConsent) {
      throw new BadRequestException('All required donor declaration confirmations must be accepted.');
    }
    if (record.hasDonatedBefore) {
      if (!record.lastDonationDate) {
        throw new BadRequestException('Please provide your last donation date.');
      }
      if (Number(record.numberOfVoluntaryDonations ?? 0) <= 0) {
        throw new BadRequestException('Please enter total previous donations.');
      }
    }
    if (record.donorType === 'REPLACEMENT_FAMILY') {
      const replacementRequired = ['patientName', 'requestReference', 'patientHospital', 'relationshipToPatient'];
      const missingReplacement = replacementRequired.filter((key) => !record[key]);
      if (missingReplacement.length) {
        throw new BadRequestException(`Missing replacement donor fields: ${missingReplacement.join(', ')}`);
      }
    }
    if (!record.healthAnswers || record.healthAnswers.length < 22) {
      throw new BadRequestException('All 22 health questionnaire questions must be answered.');
    }
    const age = Math.floor((Date.now() - new Date(record.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    if (age < 17 || age > 66) throw new BadRequestException('Donor age must be between 17 and 66 years for this workflow.');
  }

  async submit(userId: string, id: string) {
    const donor = await this.donorForUser(userId);
    const record = await this.prisma.donorClinicalRecord.findUnique({ where: { id }, include: { healthAnswers: true } });
    if (!record || record.donorId !== donor.id) throw new NotFoundException('Clinical record not found');
    if (record.status !== DonorClinicalStatus.DRAFT) throw new BadRequestException('Only draft records can be submitted.');
    this.validateSubmission(record);
    if (record.donorType === 'REPLACEMENT_FAMILY' && record.requestReference) {
      const request = await this.prisma.bloodRequest.findUnique({
        where: { requestReference: record.requestReference },
        select: { id: true },
      });
      if (!request) {
        throw new BadRequestException('Request Reference was not found. Enter a valid BDR reference.');
      }
    }

    const updated = await this.prisma.donorClinicalRecord.update({
      where: { id },
      data: { status: DonorClinicalStatus.SUBMITTED, isLocked: true, submittedAt: new Date() },
    });
    await this.prisma.donor.update({ where: { id: donor.id }, data: { eligibilityStatus: false, availabilityStatus: false } });
    const donorReference = donor.donorNumber ?? donor.id;
    await this.clinicalAudit(
      id,
      userId,
      'DONOR_CLINICAL_SUBMITTED',
      `Donor ${donorReference} submitted eligibility declaration at ${updated.submittedAt?.toISOString()}.`,
      record,
      updated,
    );
    await this.activity.log({
      actorUserId: userId,
      actorName: donor.fullName,
      type: 'DONOR_CLINICAL_SUBMITTED',
      module: 'DONOR_CLINICAL_RECORDS',
      title: 'Clinical donor form submitted',
      description: `${donor.fullName} submitted a donor clinical record for review.`,
      entityType: 'DONOR_CLINICAL_RECORD',
      entityId: id,
      donorId: donor.id,
      hospitalId: record.selectedHospitalId,
    });
    return this.getById(id, { id: userId, role: Role.DONOR });
  }

  async getMine(userId: string) {
    const donor = await this.donorForUser(userId);
    const records = await this.prisma.donorClinicalRecord.findMany({
      where: { donorId: donor.id },
      orderBy: { createdAt: 'desc' },
      include: this.includeAll,
    });
    return {
      items: records,
      latest: records[0] ?? null,
      donorProfile: {
        firstName: donor.firstName,
        otherNames: donor.otherNames,
        surname: donor.surname,
        fullName: donor.fullName,
        email: donor.user.email,
        phone: donor.phone,
      },
    };
  }

  async reviewQueue(query: ReviewQueueQueryDto, user: { id: string; role: Role }) {
    await this.assertStaffAccess(user);
    const where: any = {};
    if (query.status) where.status = query.status;
    if (!PLATFORM_REVIEW_ROLES.includes(user.role)) {
      where.selectedHospital = { userId: user.id };
    }
    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { otherNames: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { donor: { fullName: { contains: query.search, mode: 'insensitive' } } },
        { donor: { user: { email: { contains: query.search, mode: 'insensitive' } } } },
      ];
    }
    const [total, items] = await this.prisma.$transaction([
      this.prisma.donorClinicalRecord.count({ where }),
      this.prisma.donorClinicalRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip ?? 0,
        take: query.take ?? 30,
        include: this.includeAll,
      }),
    ]);
    return { total, items };
  }

  async getById(id: string, user: { id: string; role: Role }) {
    const record = await this.prisma.donorClinicalRecord.findUnique({ where: { id }, include: this.includeAll });
    if (!record) throw new NotFoundException('Clinical record not found');
    if (user.role === Role.DONOR) {
      const donor = await this.donorForUser(user.id);
      if (record.donorId !== donor.id) throw new ForbiddenException('You can only view your own clinical record.');
    } else {
      await this.assertStaffAccess(user, id);
    }
    return record;
  }

  async startReview(id: string, dto: UpdateClinicalReviewDto, user: { id: string; role: Role }) {
    await this.assertStaffAccess(user, id);
    const existing = await this.prisma.donorClinicalRecord.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Clinical record not found');
    const status = (dto.status as DonorClinicalStatus) || DonorClinicalStatus.HOSPITAL_REVIEW;
    const updated = await this.prisma.donorClinicalRecord.update({
      where: { id },
      data: { status, reviewerId: user.id, hospitalReviewedAt: new Date(), reviewNotes: dto.reviewNotes },
    });
    await this.clinicalAudit(id, user.id, 'DONOR_CLINICAL_REVIEW_UPDATED', `Clinical record moved to ${status}.`, existing, updated);
    return this.getById(id, user);
  }

  async officeUse(id: string, dto: OfficeUseDto, user: { id: string; role: Role }) {
    await this.assertStaffAccess(user, id);
    const existing = await this.prisma.donorClinicalRecord.findUnique({ where: { id }, include: { clinicalReview: true, donor: true } });
    if (!existing) throw new NotFoundException('Clinical record not found');

    const outcome = dto.outcomeOfScreening;
    const nextStatus = outcome === 'QUALIFIED'
      ? DonorClinicalStatus.APPROVED
      : outcome === 'TEMPORARILY_DEFERRED'
        ? DonorClinicalStatus.TEMPORARILY_DEFERRED
        : outcome === 'PERMANENTLY_DEFERRED'
          ? DonorClinicalStatus.PERMANENTLY_DEFERRED
          : outcome === 'REJECTED'
            ? DonorClinicalStatus.REJECTED
            : DonorClinicalStatus.OFFICE_USE_COMPLETED;

    const { confirmedBloodGroup, ...clinicalReviewDto } = dto;
    if (!dto.nurseName?.trim()) {
      throw new BadRequestException('Please provide the nurse name before completing Office Use.');
    }
    if (nextStatus === DonorClinicalStatus.APPROVED && (confirmedBloodGroup ?? existing.donor.bloodGroup) === 'UNKNOWN') {
      throw new BadRequestException('Confirm the donor blood group before approving eligibility.');
    }

    await this.prisma.donorClinicalReview.upsert({
      where: { clinicalRecordId: id },
      update: { ...clinicalReviewDto, reviewedById: user.id, reviewedAt: new Date() } as any,
      create: { clinicalRecordId: id, ...clinicalReviewDto, reviewedById: user.id, reviewedAt: new Date() } as any,
    });
    const updated = await this.prisma.donorClinicalRecord.update({
      where: { id },
      data: {
        status: nextStatus,
        reviewerId: user.id,
        officeCompletedAt: new Date(),
        finalDecisionAt: new Date(),
      },
    });
    await this.prisma.donor.update({
      where: { id: existing.donorId },
      data: {
        ...(confirmedBloodGroup ? { bloodGroup: confirmedBloodGroup } : {}),
        eligibilityStatus: nextStatus === DonorClinicalStatus.APPROVED,
        availabilityStatus: false,
      },
    });
    await this.clinicalAudit(id, user.id, 'DONOR_CLINICAL_OFFICE_USE_COMPLETED', `Office-use screening completed with ${nextStatus}.`, existing, dto);
    return this.getById(id, user);
  }

  async pdfText(id: string, user: { id: string; role: Role }) {
    const record = await this.getById(id, user);
    const lines = [
      'NATIONAL BLOOD SERVICE GHANA - DONOR CLINICAL RECORD',
      `Record ID: ${record.id}`,
      `Status: ${record.status}`,
      `Donor: ${[record.lastName, record.firstName, record.otherNames].filter(Boolean).join(' ') || record.donor.fullName}`,
      `Email: ${record.email ?? record.donor.user.email}`,
      `Hospital: ${record.selectedHospital?.hospitalName ?? 'Not selected'}`,
      '',
      'Health Questionnaire:',
      ...record.healthAnswers.map((a) => `${a.questionKey}. ${a.questionText} - ${a.answer ? 'YES' : 'NO'} ${a.details ? `(${a.details})` : ''}`),
      '',
      `Review Notes: ${record.reviewNotes ?? ''}`,
      `Office Use Screening Outcome: ${record.clinicalReview?.outcomeOfScreening ?? ''}`,
      `Qualifies: ${record.clinicalReview?.qualifiesToDonate ?? ''}`,
      `Nurse Name: ${record.clinicalReview?.nurseName ?? ''}`,
      `Temporary Deferral Duration: ${record.clinicalReview?.temporaryDeferralDuration ?? ''}`,
    ];
    return lines.join('\n');
  }
}


