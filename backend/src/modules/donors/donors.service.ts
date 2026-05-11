import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { UpsertDonorProfileDto } from './dto/upsert-donor-profile.dto';
import { CreateDonationHistoryDto } from './dto/create-donation-history.dto';
import { AuditService } from '../../common/audit/audit.service';
import { CreateDonorAdminDto } from './dto/admin/create-donor-admin.dto';
import { UpdateDonorAdminDto } from './dto/admin/update-donor-admin.dto';
import { SubmitHealthEligibilityDto } from './dto/submit-health-eligibility.dto';
import * as argon2 from 'argon2';
import { Role } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ActivityService } from '../../common/activity/activity.service';

@Injectable()
export class DonorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly activity: ActivityService,
  ) {}

  private async buildDonorNumber() {
    const latest = await this.prisma.donor.findFirst({
      where: { donorNumber: { not: null } },
      select: { donorNumber: true },
      orderBy: { donorNumber: 'desc' },
    });

    const value = latest?.donorNumber ?? '000000';
    const prefixedMatch = /^DON-(\d+)$/i.exec(value);
    const plainMatch = /^(\d+)$/.exec(value);
    const numeric = prefixedMatch
      ? Number.parseInt(prefixedMatch[1], 10)
      : plainMatch
        ? Number.parseInt(plainMatch[1], 10)
        : 0;

    return String((Number.isNaN(numeric) ? 0 : numeric) + 1).padStart(6, '0');
  }

  private normalizeDate(value?: string) {
    return value ? new Date(value) : undefined;
  }

  async upsertProfile(userId: string, dto: UpsertDonorProfileDto) {
    const existingDonor = await this.prisma.donor.findUnique({ where: { userId } });
    const payload = {
      fullName: dto.fullName,
      phone: dto.phone,
      dateOfBirth: this.normalizeDate(dto.dateOfBirth),
      bloodGroup: dto.bloodGroup,
      location: dto.location,
      postalAddress: dto.postalAddress,
      signature: dto.signature,
      passportPhotoUrl: dto.passportPhotoUrl,
      emergencyContactName: dto.emergencyContactName,
      emergencyContactPhone: dto.emergencyContactPhone,
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
        donorNumber: await this.buildDonorNumber(),
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
      include: { donationHistory: true, appointments: true, user: { select: { createdAt: true, email: true } } },
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
      include: { donationHistory: true, appointments: true, user: { select: { createdAt: true, email: true } } },
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
    const donor = await this.prisma.donor.findUnique({ where: { userId } });
    if (!donor) {
      throw new NotFoundException('Donor profile not found');
    }

    const latestReview = await this.prisma.donorEligibilityReview.findFirst({
      where: { donorId: donor.id },
      orderBy: { createdAt: 'desc' },
    });

    return {
      healthFormCompleted: Boolean(latestReview),
      healthFormSubmittedAt: latestReview?.submittedAt ?? null,
      reviewStatus: latestReview?.status ?? null,
      reviewNotes: latestReview?.reviewNotes ?? null,
      officeUseNotes: latestReview?.officeUseNotes ?? null,
      adminApproved: donor.eligibilityStatus,
      availabilityStatus: donor.availabilityStatus,
      canSetAvailable: Boolean(latestReview) && donor.eligibilityStatus,
    };
  }

  async updateAvailability(userId: string, available: boolean) {
    const donor = await this.prisma.donor.findUnique({ where: { userId } });
    if (!donor) {
      throw new NotFoundException('Donor profile not found');
    }

    if (available) {
      const submittedForm = await this.prisma.donorEligibilityReview.findFirst({
        where: { donorId: donor.id },
        orderBy: { createdAt: 'desc' },
      });

      if (!submittedForm) {
        throw new BadRequestException('Complete the health eligibility form before setting availability.');
      }
      if (!donor.eligibilityStatus) {
        throw new BadRequestException('Admin approval is required before setting availability.');
      }
    }

    const updated = await this.prisma.donor.update({
      where: { userId },
      data: { availabilityStatus: available },
    });
    await this.audit.log('DONOR_AVAILABILITY_UPDATED', 'DONOR', userId, donor.id, { available });
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

      const donor = await tx.donor.create({
        data: {
          userId: user.id,
          donorNumber: await this.buildDonorNumber(),
          fullName: dto.fullName,
          phone: dto.phone,
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

    const normalizedDonorNumber = dto.donorNumber?.trim().toUpperCase();
    if (normalizedDonorNumber) {
      const existingNumber = await this.prisma.donor.findFirst({
        where: {
          donorNumber: normalizedDonorNumber,
          id: { not: donorId },
        },
        select: { id: true },
      });
      if (existingNumber) {
        throw new BadRequestException('Donor serial number already exists. Use a unique value.');
      }
    }

    const updated = await this.prisma.donor.update({
      where: { id: donorId },
      data: {
        ...dto,
        donorNumber: normalizedDonorNumber ?? donor.donorNumber ?? (await this.buildDonorNumber()),
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
        availabilityStatus: approved ? donor.availabilityStatus : false,
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
        registrationCode: true,
      },
      orderBy: { hospitalName: 'asc' },
    });
  }
}
