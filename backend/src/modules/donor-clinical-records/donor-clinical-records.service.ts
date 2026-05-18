import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DonorClinicalStatus, Role } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { ActivityService } from '../../common/activity/activity.service';
import { PrismaService } from '../../prisma.service';
import {
  DonationOutcomeDto,
  HealthAnswerDto,
  OfficeUseDto,
  ReviewQueueQueryDto,
  UpdateClinicalReviewDto,
  UpsertDonorClinicalDraftDto,
} from './dto/donor-clinical-record.dto';

const STAFF_ROLES = new Set<Role>([
  Role.DONOR_REVIEW_OFFICER,
  Role.HOSPITAL_STAFF,
  Role.HOSPITAL_ADMIN,
  Role.SUPER_ADMIN,
  Role.ADMIN,
]);
const PLATFORM_REVIEW_ROLES: Role[] = [Role.ADMIN, Role.SUPER_ADMIN];

const RISK_YES_KEYS = new Set([
  'q2','q3','q4','q5','q6','q7','q8','q9','q10','q12','q13','q14','q15','q16','q17','q18','q19','q20','q21','q22',
]);

@Injectable()
export class DonorClinicalRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly activity: ActivityService,
  ) {}

  private date(value?: string) {
    return value ? new Date(value) : undefined;
  }

  private json(value: unknown) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  private async donorForUser(userId: string) {
    const donor = await this.prisma.donor.findUnique({ where: { userId }, include: { user: true } });
    if (!donor) throw new NotFoundException('Donor profile not found');
    return donor;
  }

  private async assertStaffAccess(user: { id: string; role: Role }, recordId?: string) {
    if (!STAFF_ROLES.has(user.role)) throw new ForbiddenException('Clinical review access is restricted.');
    if (!recordId || PLATFORM_REVIEW_ROLES.includes(user.role)) return;

    const staff = await this.prisma.staffProfile.findUnique({ where: { userId: user.id } });
    if (!staff) return;
    const record = await this.prisma.donorClinicalRecord.findUnique({ where: { id: recordId }, select: { selectedHospitalId: true } });
    if (record?.selectedHospitalId && record.selectedHospitalId !== staff.hospitalId) {
      throw new ForbiddenException('You can only review records submitted to your hospital.');
    }
  }

  private async snapshot(recordId: string, actorUserId: string | undefined, reason: string) {
    const record = await this.prisma.donorClinicalRecord.findUnique({
      where: { id: recordId },
      include: { healthAnswers: true, clinicalReview: true, donationOutcome: true },
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
    await this.prisma.donorClinicalAuditTrail.create({
      data: {
        clinicalRecordId: recordId,
        actorUserId,
        action,
        description,
        oldValue: this.json(oldValue) as object,
        newValue: this.json(newValue) as object,
      },
    });
    await this.audit.log(action, 'DONOR_CLINICAL_RECORD', actorUserId, recordId, this.json(newValue), description, {
      module: 'DONOR_CLINICAL_RECORDS',
      oldValue: this.json(oldValue),
      newValue: this.json(newValue),
    });
  }

  private recordPayload(dto: UpsertDonorClinicalDraftDto) {
    return {
      selectedHospitalId: dto.selectedHospitalId,
      formDate: this.date(dto.formDate),
      venue: dto.venue,
      title: dto.title,
      firstName: dto.firstName,
      lastName: dto.lastName,
      callingName: dto.callingName,
      dateOfBirth: this.date(dto.dateOfBirth),
      sex: dto.sex,
      areaOfResidence: dto.areaOfResidence,
      addressOrWorkplace: dto.addressOrWorkplace,
      occupation: dto.occupation,
      idType: dto.idType,
      idNumber: dto.idNumber,
      phoneNumber: dto.phoneNumber,
      email: dto.email,
      preferredContactMethod: dto.preferredContactMethod,
      doNotContactForDonation: dto.doNotContactForDonation ?? false,
      donorType: dto.donorType ?? 'VOLUNTARY',
      hasDonatedBefore: dto.hasDonatedBefore,
      lastDonationDate: this.date(dto.lastDonationDate),
      numberOfVoluntaryDonations: dto.numberOfVoluntaryDonations ?? 0,
      numberOfReplacementDonations: dto.numberOfReplacementDonations ?? 0,
      donorCardNumber: dto.donorCardNumber,
      patientName: dto.patientName,
      patientHospital: dto.patientHospital,
      ward: dto.ward,
      relationshipToPatient: dto.relationshipToPatient,
      clerkingOfficerName: dto.clerkingOfficerName,
      clerkingOfficerSignature: dto.clerkingOfficerSignature,
      declarationConfirmed: dto.declarationConfirmed ?? false,
      testingConsent: dto.testingConsent ?? false,
      contactConsent: dto.contactConsent ?? false,
      staffEligibilityConsent: dto.staffEligibilityConsent ?? false,
      dataUseConsent: dto.dataUseConsent ?? false,
      donorSignature: dto.donorSignature,
      declarationDate: this.date(dto.declarationDate),
      counsellorName: dto.counsellorName,
      counsellorSignature: dto.counsellorSignature,
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
    donationOutcome: true,
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
    const required = ['selectedHospitalId', 'firstName', 'lastName', 'dateOfBirth', 'sex', 'phoneNumber', 'email'];
    const missing = required.filter((key) => !record[key]);
    if (missing.length) throw new BadRequestException(`Missing required clinical fields: ${missing.join(', ')}`);
    if (!record.declarationConfirmed || !record.testingConsent || !record.staffEligibilityConsent || !record.dataUseConsent) {
      throw new BadRequestException('All required donor declaration confirmations must be accepted.');
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

    const updated = await this.prisma.donorClinicalRecord.update({
      where: { id },
      data: { status: DonorClinicalStatus.SUBMITTED, isLocked: true, submittedAt: new Date() },
    });
    await this.prisma.donor.update({ where: { id: donor.id }, data: { eligibilityStatus: false, availabilityStatus: false } });
    await this.clinicalAudit(id, userId, 'DONOR_CLINICAL_SUBMITTED', 'Donor submitted National Blood Service style clinical record.', record, updated);
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
    return { items: records, latest: records[0] ?? null };
  }

  async reviewQueue(query: ReviewQueueQueryDto, user: { id: string; role: Role }) {
    await this.assertStaffAccess(user);
    const staff = await this.prisma.staffProfile.findUnique({ where: { userId: user.id } });
    const where: any = {};
    if (query.status) where.status = query.status;
    if (staff && !PLATFORM_REVIEW_ROLES.includes(user.role)) where.selectedHospitalId = staff.hospitalId;
    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
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

    await this.prisma.donorClinicalReview.upsert({
      where: { clinicalRecordId: id },
      update: { ...dto, reviewedById: user.id, reviewedAt: new Date() } as any,
      create: { clinicalRecordId: id, ...dto, reviewedById: user.id, reviewedAt: new Date() } as any,
    });
    const updated = await this.prisma.donorClinicalRecord.update({
      where: { id },
      data: { status: nextStatus, reviewerId: user.id, officeCompletedAt: new Date(), finalDecisionAt: new Date() },
    });
    await this.prisma.donor.update({
      where: { id: existing.donorId },
      data: { eligibilityStatus: nextStatus === DonorClinicalStatus.APPROVED, availabilityStatus: false },
    });
    await this.clinicalAudit(id, user.id, 'DONOR_CLINICAL_OFFICE_USE_COMPLETED', `Office-use screening completed with ${nextStatus}.`, existing, dto);
    return this.getById(id, user);
  }

  async donationOutcome(id: string, dto: DonationOutcomeDto, user: { id: string; role: Role }) {
    await this.assertStaffAccess(user, id);
    const existing = await this.prisma.donorClinicalRecord.findUnique({ where: { id }, include: { donor: true, selectedHospital: true } });
    if (!existing) throw new NotFoundException('Clinical record not found');
    if (existing.status !== DonorClinicalStatus.APPROVED) throw new BadRequestException('Donation outcome can only be recorded after approval.');
    await this.prisma.donorClinicalDonationOutcome.upsert({
      where: { clinicalRecordId: id },
      update: { ...dto, bleedStartTime: this.date(dto.bleedStartTime), bleedEndTime: this.date(dto.bleedEndTime) } as any,
      create: { clinicalRecordId: id, ...dto, bleedStartTime: this.date(dto.bleedStartTime), bleedEndTime: this.date(dto.bleedEndTime) } as any,
    });
    if (dto.outcomeOfPhlebotomy === 'SUCCESSFUL') {
      await this.prisma.donation.create({
        data: {
          donorId: existing.donorId,
          hospitalId: existing.selectedHospitalId,
          bloodGroup: existing.donor.bloodGroup,
          donatedAt: dto.bleedEndTime ? new Date(dto.bleedEndTime) : new Date(),
          unitsDonated: 1,
          location: existing.selectedHospital?.location ?? existing.venue ?? 'Donation center',
          screeningResult: 'Approved clinical record donation',
          notes: dto.donationNumber,
        },
      });
    }
    await this.clinicalAudit(id, user.id, 'DONOR_CLINICAL_DONATION_OUTCOME_RECORDED', 'Donation outcome section recorded.', existing, dto);
    return this.getById(id, user);
  }

  async pdfText(id: string, user: { id: string; role: Role }) {
    const record = await this.getById(id, user);
    const lines = [
      'NATIONAL BLOOD SERVICE GHANA - DONOR CLINICAL RECORD',
      `Record ID: ${record.id}`,
      `Status: ${record.status}`,
      `Donor: ${record.firstName ?? ''} ${record.lastName ?? ''}`,
      `Email: ${record.email ?? record.donor.user.email}`,
      `Hospital: ${record.selectedHospital?.hospitalName ?? 'Not selected'}`,
      '',
      'Health Questionnaire:',
      ...record.healthAnswers.map((a) => `${a.questionKey}. ${a.questionText} - ${a.answer ? 'YES' : 'NO'} ${a.details ? `(${a.details})` : ''}`),
      '',
      `Review Notes: ${record.reviewNotes ?? ''}`,
      `Office Use Outcome: ${record.clinicalReview?.outcomeOfScreening ?? ''}`,
      `Donation Number: ${record.donationOutcome?.donationNumber ?? ''}`,
    ];
    return lines.join('\n');
  }
}
