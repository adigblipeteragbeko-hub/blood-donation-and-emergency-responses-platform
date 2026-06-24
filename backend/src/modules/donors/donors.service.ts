import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { UpsertDonorProfileDto } from './dto/upsert-donor-profile.dto';
import { CreateDonationHistoryDto } from './dto/create-donation-history.dto';
import { AuditService } from '../../common/audit/audit.service';
import { CreateDonorAdminDto } from './dto/admin/create-donor-admin.dto';
import { UpdateDonorAdminDto } from './dto/admin/update-donor-admin.dto';
import { SubmitHealthEligibilityDto } from './dto/submit-health-eligibility.dto';
import * as argon2 from 'argon2';
import { DonorClinicalStatus, DonorProfileVisibility, Role } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ActivityService } from '../../common/activity/activity.service';
import { generateDonorReference } from '../../common/utils/donor-reference';
import { UpdateDonorSettingsDto } from './dto/update-donor-settings.dto';

@Injectable()
export class DonorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly activity: ActivityService,
  ) {}

  private normalizeDate(value?: string) {
    return value ? new Date(value) : undefined;
  }

  private buildDonorDisplayName(profile: {
    firstName?: string | null;
    otherNames?: string | null;
    surname?: string | null;
    fullName?: string | null;
  }) {
    return [profile.surname, profile.firstName, profile.otherNames]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(' ') || profile.fullName?.trim() || 'Unnamed Donor';
  }

  private async getLatestClinicalRecord(donorId: string) {
    return this.prisma.donorClinicalRecord.findFirst({
      where: { donorId },
      orderBy: { createdAt: 'desc' },
      include: { clinicalReview: true },
    });
  }

  private buildAvailabilityReadiness(donor: {
    eligibilityStatus: boolean;
    availabilityStatus: boolean;
    bloodGroup: string;
    lastDonationDate?: Date | null;
    nextEligibilityDate?: Date | null;
    user?: { isActive: boolean; emailVerified: boolean } | null;
  }, latestClinical: Awaited<ReturnType<DonorsService['getLatestClinicalRecord']>>) {
    const blockedStatuses = new Set<DonorClinicalStatus>([
      DonorClinicalStatus.REJECTED,
      DonorClinicalStatus.TEMPORARILY_DEFERRED,
      DonorClinicalStatus.PERMANENTLY_DEFERRED,
    ]);
    const clinicalStatus = latestClinical?.status ?? null;
    const healthFormSubmitted = Boolean(latestClinical && clinicalStatus !== DonorClinicalStatus.DRAFT);
    const healthFormCompleted = clinicalStatus === DonorClinicalStatus.APPROVED;
    const officeUseCompleted = Boolean(latestClinical?.officeCompletedAt || latestClinical?.clinicalReview);
    const bloodGroupConfirmed = donor.bloodGroup !== 'UNKNOWN';
    const accountActive = donor.user?.isActive ?? false;
    const emailVerified = donor.user?.emailVerified ?? false;
    const blockedByDecision = clinicalStatus ? blockedStatuses.has(clinicalStatus) : false;
    const nextEligibilityDate = donor.nextEligibilityDate ?? null;
    const blockedByRecentDonation = Boolean(nextEligibilityDate && nextEligibilityDate > new Date());

    let reason = 'You can now set your donor availability.';
    if (!accountActive) {
      reason = 'Your account is inactive. Please contact support.';
    } else if (!emailVerified) {
      reason = 'Please verify your email before setting availability.';
    } else if (!latestClinical) {
      reason = 'Submit your Health & Eligibility Form before setting availability.';
    } else if (!healthFormSubmitted) {
      reason = 'Submit your Health & Eligibility Form before setting availability.';
    } else if (blockedByDecision) {
      reason = 'Your latest screening decision does not allow donation availability.';
    } else if (!officeUseCompleted) {
      reason = 'Your form is waiting for hospital office-use screening.';
    } else if (!healthFormCompleted) {
      reason = 'Your form is waiting for final hospital approval.';
    } else if (!bloodGroupConfirmed) {
      reason = 'Hospital blood group confirmation is required before setting availability.';
    } else if (!donor.eligibilityStatus) {
      reason = 'Final donor approval is required before setting availability.';
    } else if (blockedByRecentDonation) {
      reason = `You recently donated blood. You can become available again on ${nextEligibilityDate?.toLocaleDateString()}.`;
    }

    const canSetAvailable = accountActive
      && emailVerified
      && Boolean(latestClinical)
      && healthFormCompleted
      && officeUseCompleted
      && bloodGroupConfirmed
      && donor.eligibilityStatus
      && !blockedByDecision
      && !blockedByRecentDonation;

    return {
      canSetAvailable,
      reason,
      healthFormSubmitted,
      healthFormCompleted,
      clinicalStatus,
      officeUseCompleted,
      bloodGroupConfirmed,
      adminApproved: donor.eligibilityStatus,
      accountActive,
      emailVerified,
      nextEligibilityDate,
      blockedByRecentDonation,
    };
  }

  private async reconcileClinicalApprovalState(donor: {
    id: string;
    eligibilityStatus: boolean;
    availabilityStatus: boolean;
    bloodGroup: string;
    nextEligibilityDate?: Date | null;
    userId: string;
  }, latestClinical: Awaited<ReturnType<DonorsService['getLatestClinicalRecord']>>) {
    const invalidStatuses = new Set<DonorClinicalStatus>([
      DonorClinicalStatus.REJECTED,
      DonorClinicalStatus.TEMPORARILY_DEFERRED,
      DonorClinicalStatus.PERMANENTLY_DEFERRED,
    ]);
    const updates: { eligibilityStatus?: boolean; availabilityStatus?: boolean } = {};

    if (latestClinical?.status === DonorClinicalStatus.APPROVED && donor.bloodGroup !== 'UNKNOWN' && !donor.eligibilityStatus) {
      updates.eligibilityStatus = true;
    }

    if (latestClinical?.status && invalidStatuses.has(latestClinical.status)) {
      if (donor.eligibilityStatus) updates.eligibilityStatus = false;
      if (donor.availabilityStatus) updates.availabilityStatus = false;
    }

    if (donor.bloodGroup === 'UNKNOWN' && donor.availabilityStatus) {
      updates.availabilityStatus = false;
    }

    if (donor.nextEligibilityDate && donor.nextEligibilityDate > new Date() && donor.availabilityStatus) {
      updates.availabilityStatus = false;
    }

    if (!Object.keys(updates).length) {
      return null;
    }

    return this.prisma.donor.update({
      where: { id: donor.id },
      data: updates,
      include: { user: { select: { isActive: true, emailVerified: true } } },
    });
  }

  async upsertProfile(userId: string, dto: UpsertDonorProfileDto) {
    const existingDonor = await this.prisma.donor.findUnique({ where: { userId } });
    const fullName = this.buildDonorDisplayName(dto);
    const payload = {
      fullName,
      firstName: dto.firstName?.trim(),
      otherNames: dto.otherNames?.trim() || null,
      surname: dto.surname?.trim(),
      phone: dto.phone,
      alternativePhoneNumber: dto.alternativePhoneNumber,
      dateOfBirth: this.normalizeDate(dto.dateOfBirth),
      bloodGroup: dto.bloodGroup,
      location: dto.location,
      postalAddress: dto.postalAddress,
      preferredHospitalId: dto.preferredHospitalId || null,
      signature: dto.signature,
      passportPhotoUrl: dto.passportPhotoUrl,
      emergencyContactName: dto.emergencyContactName,
      emergencyContactPhone: dto.emergencyContactPhone,
      emergencyContactRelationship: dto.emergencyContactRelationship,
      notificationEmailEnabled: dto.notificationEmailEnabled,
      notificationSmsEnabled: dto.notificationSmsEnabled,
    };

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const donor = await this.prisma.donor.upsert({
      where: { userId },
      update: {
        ...payload,
        eligibilityStatus: existingDonor?.eligibilityStatus ?? false,
        availabilityStatus: existingDonor?.availabilityStatus ?? false,
      },
      create: {
        ...payload,
        userId,
        donorNumber: await generateDonorReference(this.prisma),
        dateIssued: user.createdAt,
        eligibilityStatus: false,
        availabilityStatus: false,
      },
      include: { donationHistory: true, appointments: true },
    });

    await this.audit.log('DONOR_PROFILE_UPSERTED', 'DONOR', userId, donor.id, payload);
    return donor;
  }

  async getProfile(userId: string) {
    const donor = await this.prisma.donor.findUnique({
      where: { userId },
      include: {
        donationHistory: { include: { hospital: { select: { hospitalName: true, location: true } } }, orderBy: { donatedAt: 'desc' } },
        appointments: true,
        preferredHospital: { select: { id: true, hospitalName: true, location: true, city: true, region: true } },
        user: { select: { createdAt: true, email: true } },
      },
    });

    if (!donor) {
      throw new NotFoundException('Donor profile not found');
    }

    return donor;
  }

  async updatePassportPhoto(userId: string, passportPhotoUrl: string) {
    const donor = await this.prisma.donor.findUnique({ where: { userId } });
    if (!donor) {
      throw new NotFoundException('Donor profile not found');
    }

    if (
      !passportPhotoUrl.startsWith('data:image/jpeg;base64,') &&
      !passportPhotoUrl.startsWith('data:image/png;base64,') &&
      !passportPhotoUrl.startsWith('data:image/webp;base64,')
    ) {
      throw new BadRequestException('Passport photo must be a base64 image (jpeg, png, or webp).');
    }

    const updated = await this.prisma.donor.update({
      where: { userId },
      data: { passportPhotoUrl },
      include: {
        donationHistory: { include: { hospital: { select: { hospitalName: true, location: true } } }, orderBy: { donatedAt: 'desc' } },
        appointments: true,
        user: { select: { createdAt: true, email: true } },
      },
    });

    await this.audit.log('DONOR_PASSPORT_PHOTO_UPDATED', 'DONOR', userId, donor.id, { hasPhoto: Boolean(passportPhotoUrl) });
    return updated;
  }

  async addDonationHistory(userId: string, dto: CreateDonationHistoryDto) {
    const donor = await this.prisma.donor.findUnique({ where: { userId } });
    if (!donor) {
      throw new NotFoundException('Donor profile not found');
    }

    const entry = await this.prisma.donation.create({
      data: {
        donorId: donor.id,
        donatedAt: new Date(dto.donatedAt),
        unitsDonated: dto.unitsDonated,
        location: dto.location,
        notes: dto.notes,
      },
    });

    await this.audit.log('DONATION_RECORDED', 'DONATION', userId, entry.id, dto);
    return entry;
  }

  async submitHealthForm(userId: string, dto: SubmitHealthEligibilityDto) {
    const donor = await this.prisma.donor.findUnique({ where: { userId } });
    if (!donor) {
      throw new NotFoundException('Donor profile not found');
    }

    const selectedHospital = await this.prisma.hospital.findUnique({ where: { id: dto.selectedHospitalId } });
    if (!selectedHospital) {
      throw new BadRequestException('Selected hospital is invalid.');
    }

    const payloadSize = JSON.stringify(dto).length;
    if (payloadSize > 120_000) {
      throw new BadRequestException('Health form payload is too large.');
    }

    await this.prisma.donor.update({
      where: { userId },
      data: {
        availabilityStatus: false,
      },
    });

    const existingReview = await this.prisma.donorEligibilityReview.findFirst({
      where: { donorId: donor.id },
      orderBy: { createdAt: 'desc' },
    });

    if (existingReview && existingReview.status !== 'APPROVED') {
      await this.prisma.donorEligibilityReview.update({
        where: { id: existingReview.id },
        data: {
          selectedHospitalId: selectedHospital.id,
          status: 'SUBMITTED',
          reviewNotes: null,
          officeUseNotes: null,
          submittedAt: new Date(),
          hospitalReviewedAt: null,
          officeCompletedAt: null,
          approvedAt: null,
          rejectedAt: null,
          reviewerId: null,
        },
      });
    } else {
      await this.prisma.donorEligibilityReview.create({
        data: {
          donorId: donor.id,
          selectedHospitalId: selectedHospital.id,
          status: 'SUBMITTED',
        },
      });
    }

    await this.audit.log('DONOR_HEALTH_FORM_SUBMITTED', 'DONOR', userId, donor.id, dto);
    await this.activity.log({
      actorUserId: userId,
      actorName: donor.fullName,
      type: 'DONOR_REVIEW_SUBMITTED',
      module: 'DONOR_REVIEW',
      title: 'Donor clinical form submitted',
      description: `${donor.fullName} submitted an eligibility form to ${selectedHospital.hospitalName}.`,
      entityType: 'DONOR',
      entityId: donor.id,
      donorId: donor.id,
      hospitalId: selectedHospital.id,
    });
    return {
      message: 'Health form submitted. Waiting for hospital approval.',
      selectedHospitalId: selectedHospital.id,
      selectedHospitalName: selectedHospital.hospitalName,
      pendingAdminApproval: true,
    };
  }

  async getEligibilityStatus(userId: string) {
    let donor = await this.prisma.donor.findUnique({
      where: { userId },
      include: { user: { select: { isActive: true, emailVerified: true } } },
    });
    if (!donor) {
      throw new NotFoundException('Donor profile not found');
    }

    const latestClinical = await this.getLatestClinicalRecord(donor.id);
    const reconciled = await this.reconcileClinicalApprovalState(donor, latestClinical);
    donor = reconciled ?? donor;
    const readiness = this.buildAvailabilityReadiness(donor, latestClinical);

    return {
      healthFormCompleted: readiness.healthFormCompleted,
      healthFormSubmitted: readiness.healthFormSubmitted,
      healthFormSubmittedAt: latestClinical?.submittedAt ?? null,
      reviewStatus: readiness.clinicalStatus,
      reviewNotes: latestClinical?.reviewNotes ?? null,
      officeUseNotes: latestClinical?.clinicalReview?.comments ?? null,
      adminApproved: readiness.adminApproved,
      availabilityStatus: donor.availabilityStatus,
      canSetAvailable: readiness.canSetAvailable,
      reason: readiness.reason,
      officeUseCompleted: readiness.officeUseCompleted,
      bloodGroupConfirmed: readiness.bloodGroupConfirmed,
      bloodGroup: donor.bloodGroup,
      lastDonationDate: donor.lastDonationDate,
      nextEligibilityDate: donor.nextEligibilityDate,
      accountActive: readiness.accountActive,
      emailVerified: readiness.emailVerified,
      blockedByRecentDonation: readiness.blockedByRecentDonation,
    };
  }

  async updateAvailability(userId: string, available: boolean) {
    let donor = await this.prisma.donor.findUnique({
      where: { userId },
      include: { user: { select: { isActive: true, emailVerified: true } } },
    });
    if (!donor) {
      throw new NotFoundException('Donor profile not found');
    }

    const latestClinical = await this.getLatestClinicalRecord(donor.id);
    const reconciled = await this.reconcileClinicalApprovalState(donor, latestClinical);
    donor = reconciled ?? donor;
    const readiness = this.buildAvailabilityReadiness(donor, latestClinical);

    if (available) {
      if (!readiness.canSetAvailable) {
        throw new BadRequestException(readiness.reason);
      }
    }

    const updated = await this.prisma.donor.update({
      where: { userId },
      data: { availabilityStatus: available },
    });
    await this.audit.log('DONOR_AVAILABILITY_UPDATED', 'DONOR', userId, donor.id, { available });
    return updated;
  }

  async updateSettings(userId: string, dto: UpdateDonorSettingsDto) {
    const donor = await this.prisma.donor.findUnique({ where: { userId } });
    if (!donor) {
      throw new NotFoundException('Donor profile not found');
    }

    const updated = await this.prisma.donor.update({
      where: { userId },
      data: {
        notificationEmailEnabled: dto.notificationEmailEnabled ?? donor.notificationEmailEnabled,
        notificationSmsEnabled: dto.notificationSmsEnabled ?? donor.notificationSmsEnabled,
        profileVisibility: dto.profileVisibility ?? donor.profileVisibility ?? DonorProfileVisibility.PRIVATE,
      },
      include: {
        donationHistory: { include: { hospital: { select: { hospitalName: true, location: true } } }, orderBy: { donatedAt: 'desc' } },
        appointments: true,
        user: { select: { createdAt: true, email: true } },
      },
    });

    await this.audit.log('DONOR_SETTINGS_UPDATED', 'DONOR', userId, donor.id, {
      notificationEmailEnabled: updated.notificationEmailEnabled,
      notificationSmsEnabled: updated.notificationSmsEnabled,
      profileVisibility: updated.profileVisibility,
    });
    return updated;
  }

  listAllForAdmin(query: PaginationQueryDto) {
    const skip = query.skip ?? 0;
    const take = query.take ?? 100;
    return this.prisma.donor.findMany({
      include: {
        user: { select: { id: true, email: true, role: true, isActive: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  async createByAdmin(dto: CreateDonorAdminDto, actorUserId: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new BadRequestException('Email already exists');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash: await argon2.hash(dto.password),
          role: Role.DONOR,
          emailVerified: true,
        },
      });

      const fullName = this.buildDonorDisplayName(dto);
      const donor = await tx.donor.create({
        data: {
          userId: user.id,
          donorNumber: await generateDonorReference(tx),
          fullName,
          firstName: dto.firstName?.trim(),
          otherNames: dto.otherNames?.trim() || null,
          surname: dto.surname?.trim(),
          phone: dto.phone,
          alternativePhoneNumber: dto.alternativePhoneNumber,
          dateOfBirth: this.normalizeDate(dto.dateOfBirth),
          bloodGroup: dto.bloodGroup,
          location: dto.location,
          postalAddress: dto.postalAddress,
          signature: dto.signature,
          passportPhotoUrl: dto.passportPhotoUrl,
          dateIssued: this.normalizeDate(dto.dateIssued) ?? new Date(),
          eligibilityStatus: false,
          availabilityStatus: false,
          emergencyContactName: dto.emergencyContactName,
          emergencyContactPhone: dto.emergencyContactPhone,
          emergencyContactRelationship: dto.emergencyContactRelationship,
          notificationEmailEnabled: dto.notificationEmailEnabled ?? true,
          notificationSmsEnabled: dto.notificationSmsEnabled ?? false,
        },
        include: {
          user: { select: { id: true, email: true, role: true, isActive: true } },
        },
      });

      return donor;
    });

    await this.audit.log('DONOR_CREATED_BY_ADMIN', 'DONOR', actorUserId, created.id, { email: dto.email });
    return created;
  }

  async updateByAdmin(donorId: string, dto: UpdateDonorAdminDto, actorUserId: string) {
    const donor = await this.prisma.donor.findUnique({ where: { id: donorId } });
    if (!donor) {
      throw new NotFoundException('Donor not found');
    }

    const updated = await this.prisma.donor.update({
      where: { id: donorId },
      data: {
        ...dto,
        fullName: this.buildDonorDisplayName({ ...donor, ...dto }),
        otherNames: dto.otherNames?.trim() || dto.otherNames,
        donorNumber: donor.donorNumber ?? (await generateDonorReference(this.prisma)),
        dateOfBirth: this.normalizeDate(dto.dateOfBirth),
        dateIssued: this.normalizeDate(dto.dateIssued),
      },
      include: {
        user: { select: { id: true, email: true, role: true, isActive: true } },
      },
    });

    await this.audit.log('DONOR_UPDATED_BY_ADMIN', 'DONOR', actorUserId, donorId, dto);
    return updated;
  }

  async removeByAdmin(donorId: string, actorUserId: string) {
    const donor = await this.prisma.donor.findUnique({ where: { id: donorId }, include: { user: true } });
    if (!donor) {
      throw new NotFoundException('Donor not found');
    }

    await this.prisma.user.delete({ where: { id: donor.userId } });
    await this.audit.log('DONOR_DELETED_BY_ADMIN', 'DONOR', actorUserId, donorId, { email: donor.user.email });
    return { message: 'Donor deleted successfully' };
  }

  async updateEligibilityApproval(donorId: string, approved: boolean, actorUserId: string) {
    const donor = await this.prisma.donor.findUnique({ where: { id: donorId } });
    if (!donor) {
      throw new NotFoundException('Donor not found');
    }

    const updated = await this.prisma.donor.update({
      where: { id: donorId },
      data: {
        eligibilityStatus: approved,
        availabilityStatus: approved && donor.bloodGroup !== 'UNKNOWN' ? donor.availabilityStatus : false,
      },
      include: { user: { select: { id: true, email: true, role: true, isActive: true } } },
    });

    const latestReview = await this.prisma.donorEligibilityReview.findFirst({
      where: { donorId },
      orderBy: { createdAt: 'desc' },
    });

    if (latestReview) {
      await this.prisma.donorEligibilityReview.update({
        where: { id: latestReview.id },
        data: {
          status: approved ? 'APPROVED' : 'REJECTED',
          reviewerId: actorUserId,
          approvedAt: approved ? new Date() : null,
          rejectedAt: approved ? null : new Date(),
        },
      });
    }

    await this.audit.log('DONOR_ELIGIBILITY_APPROVAL_UPDATED', 'DONOR', actorUserId, donorId, { approved });
    await this.activity.log({
      actorUserId,
      actorName: updated.fullName,
      type: approved ? 'DONOR_APPROVED' : 'DONOR_REJECTED',
      module: 'DONOR_REVIEW',
      title: approved ? 'Donor approved' : 'Donor rejected',
      description: `${updated.fullName} was ${approved ? 'approved' : 'rejected'} for donation eligibility review.`,
      entityType: 'DONOR',
      entityId: donorId,
      donorId,
    });
    return updated;
  }

  async getHospitalOptions() {
    return this.prisma.hospital.findMany({
      select: {
        id: true,
        hospitalName: true,
        location: true,
        address: true,
        city: true,
        region: true,
        registrationCode: true,
      },
      orderBy: { hospitalName: 'asc' },
    });
  }
}
