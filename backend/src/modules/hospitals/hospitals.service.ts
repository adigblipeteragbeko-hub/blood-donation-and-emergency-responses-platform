import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { UpsertHospitalProfileDto } from './dto/upsert-hospital-profile.dto';
import { AuditService } from '../../common/audit/audit.service';
import { CreateHospitalAdminDto } from './dto/admin/create-hospital-admin.dto';
import { UpdateHospitalAdminDto } from './dto/admin/update-hospital-admin.dto';
import * as argon2 from 'argon2';
import { Role } from '@prisma/client';
import { DonorSearchDto } from './dto/donor-search.dto';

@Injectable()
export class HospitalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async upsertProfile(userId: string, dto: UpsertHospitalProfileDto) {
    const hospital = await this.prisma.hospital.upsert({
      where: { userId },
      update: dto,
      create: { ...dto, userId },
    });

    await this.audit.log('HOSPITAL_PROFILE_UPSERTED', 'HOSPITAL', userId, hospital.id, dto);
    return hospital;
  }

  async getProfile(userId: string) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { userId },
      include: { bloodRequests: true, inventoryItems: true },
    });

    if (!hospital) {
      throw new NotFoundException('Hospital profile not found');
    }

    return hospital;
  }

  async searchDonors(userId: string, query: DonorSearchDto) {
    const hospital = await this.prisma.hospital.findUnique({ where: { userId } });
    if (!hospital) {
      throw new NotFoundException('Hospital profile not found');
    }

    const locationFilter = query.location?.trim() || hospital.location;

    return this.prisma.donor.findMany({
      where: {
        bloodGroup: query.bloodGroup,
        availabilityStatus: true,
        eligibilityStatus: true,
        location: locationFilter
          ? {
              contains: locationFilter,
              mode: 'insensitive',
            }
          : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        fullName: true,
        bloodGroup: true,
        location: true,
        emergencyContactPhone: true,
        availabilityStatus: true,
        eligibilityStatus: true,
      },
    });
  }

  listAllForAdmin() {
    return this.prisma.hospital.findMany({
      include: {
        user: { select: { id: true, email: true, role: true, isActive: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createByAdmin(dto: CreateHospitalAdminDto, actorUserId: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new BadRequestException('Email already exists');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash: await argon2.hash(dto.password),
          role: Role.HOSPITAL_STAFF,
          emailVerified: true,
        },
      });

      const hospital = await tx.hospital.create({
        data: {
          userId: user.id,
          hospitalName: dto.hospitalName,
          registrationCode: dto.registrationCode,
          address: dto.address,
          location: dto.location,
          contactName: dto.contactName,
          contactPhone: dto.contactPhone,
        },
        include: {
          user: { select: { id: true, email: true, role: true, isActive: true } },
        },
      });

      return hospital;
    });

    await this.audit.log('HOSPITAL_CREATED_BY_ADMIN', 'HOSPITAL', actorUserId, created.id, { email: dto.email });
    return created;
  }

  async updateByAdmin(hospitalId: string, dto: UpdateHospitalAdminDto, actorUserId: string) {
    const hospital = await this.prisma.hospital.findUnique({ where: { id: hospitalId } });
    if (!hospital) {
      throw new NotFoundException('Hospital not found');
    }

    const updated = await this.prisma.hospital.update({
      where: { id: hospitalId },
      data: dto,
      include: {
        user: { select: { id: true, email: true, role: true, isActive: true } },
      },
    });

    await this.audit.log('HOSPITAL_UPDATED_BY_ADMIN', 'HOSPITAL', actorUserId, hospitalId, dto);
    return updated;
  }

  async removeByAdmin(hospitalId: string, actorUserId: string) {
    const hospital = await this.prisma.hospital.findUnique({ where: { id: hospitalId }, include: { user: true } });
    if (!hospital) {
      throw new NotFoundException('Hospital not found');
    }

    await this.prisma.user.delete({ where: { id: hospital.userId } });
    await this.audit.log('HOSPITAL_DELETED_BY_ADMIN', 'HOSPITAL', actorUserId, hospitalId, {
      email: hospital.user.email,
    });

    return { message: 'Hospital deleted successfully' };
  }

  private async getHospitalByUser(userId: string) {
    const hospital = await this.prisma.hospital.findUnique({ where: { userId } });
    if (!hospital) {
      throw new NotFoundException('Hospital profile not found');
    }
    return hospital;
  }

  async getEligibilitySubmissions(userId: string) {
    const hospital = await this.getHospitalByUser(userId);

    const submissionLogs = await this.prisma.auditLog.findMany({
      where: { action: 'DONOR_HEALTH_FORM_SUBMITTED', entityType: 'DONOR' },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const officeUseLogs = await this.prisma.auditLog.findMany({
      where: { action: 'HOSPITAL_OFFICE_USE_SUBMITTED', entityType: 'DONOR' },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const officeUseByDonor = new Map<string, any>();
    for (const entry of officeUseLogs) {
      const md = (entry.metadata as any) ?? {};
      if (md?.hospitalId !== hospital.id) {
        continue;
      }
      const donorId = entry.entityId ?? md?.donorId;
      if (donorId && !officeUseByDonor.has(donorId)) {
        officeUseByDonor.set(donorId, { createdAt: entry.createdAt, officeUseOnly: md?.officeUseOnly ?? null });
      }
    }

    const selectedForHospital = submissionLogs.filter((log) => {
      const md = (log.metadata as any) ?? {};
      return md?.selectedHospitalId === hospital.id;
    });

    const donorIds = [...new Set(selectedForHospital.map((log) => log.entityId).filter(Boolean))] as string[];
    const donors = donorIds.length
      ? await this.prisma.donor.findMany({
          where: { id: { in: donorIds } },
          include: { user: { select: { email: true } } },
        })
      : [];
    const donorMap = new Map(donors.map((d) => [d.id, d]));

    return selectedForHospital.map((log) => {
      const md = (log.metadata as any) ?? {};
      const donorId = log.entityId ?? '';
      const donor = donorMap.get(donorId);
      return {
        donorId,
        submittedAt: log.createdAt,
        selectedHospitalId: md?.selectedHospitalId,
        donorForm: {
          personalInformation: md?.personalInformation ?? {},
          donationHistory: md?.donationHistory ?? {},
          replacementFamilyDonor: md?.replacementFamilyDonor ?? {},
          healthQuestionnaire: md?.healthQuestionnaire ?? {},
          donorDeclarationAccepted: md?.donorDeclarationAccepted ?? false,
        },
        donor: donor
          ? {
              fullName: donor.fullName,
              bloodGroup: donor.bloodGroup,
              location: donor.location,
              email: donor.user.email,
              eligibilityStatus: donor.eligibilityStatus,
              availabilityStatus: donor.availabilityStatus,
            }
          : null,
        officeUse: officeUseByDonor.get(donorId) ?? null,
      };
    });
  }

  async submitOfficeUse(userId: string, donorId: string, officeUseOnly: Record<string, unknown>) {
    const hospital = await this.getHospitalByUser(userId);
    const donor = await this.prisma.donor.findUnique({ where: { id: donorId } });
    if (!donor) {
      throw new NotFoundException('Donor not found');
    }

    const donorSubmission = await this.prisma.auditLog.findFirst({
      where: { action: 'DONOR_HEALTH_FORM_SUBMITTED', entityType: 'DONOR', entityId: donorId },
      orderBy: { createdAt: 'desc' },
    });
    if (!donorSubmission) {
      throw new BadRequestException('No donor form submission found.');
    }
    const submissionMd = (donorSubmission.metadata as any) ?? {};
    if (submissionMd?.selectedHospitalId !== hospital.id) {
      throw new BadRequestException('This donor did not submit to your hospital.');
    }

    await this.audit.log('HOSPITAL_OFFICE_USE_SUBMITTED', 'DONOR', userId, donorId, {
      hospitalId: hospital.id,
      officeUseOnly,
    });

    return { message: 'Office-use section saved for donor.' };
  }

  async approveEligibility(userId: string, donorId: string, approved: boolean) {
    const hospital = await this.getHospitalByUser(userId);
    const donor = await this.prisma.donor.findUnique({ where: { id: donorId } });
    if (!donor) {
      throw new NotFoundException('Donor not found');
    }

    const donorSubmission = await this.prisma.auditLog.findFirst({
      where: { action: 'DONOR_HEALTH_FORM_SUBMITTED', entityType: 'DONOR', entityId: donorId },
      orderBy: { createdAt: 'desc' },
    });
    if (!donorSubmission) {
      throw new BadRequestException('No donor form submission found.');
    }
    const submissionMd = (donorSubmission.metadata as any) ?? {};
    if (submissionMd?.selectedHospitalId !== hospital.id) {
      throw new BadRequestException('This donor did not submit to your hospital.');
    }

    const officeUse = await this.prisma.auditLog.findFirst({
      where: { action: 'HOSPITAL_OFFICE_USE_SUBMITTED', entityType: 'DONOR', entityId: donorId },
      orderBy: { createdAt: 'desc' },
    });
    const officeUseMd = (officeUse?.metadata as any) ?? {};
    if (!officeUse || officeUseMd?.hospitalId !== hospital.id) {
      throw new BadRequestException('Hospital must complete Office Use Only form before approval.');
    }

    const updated = await this.prisma.donor.update({
      where: { id: donorId },
      data: {
        eligibilityStatus: approved,
        availabilityStatus: approved ? donor.availabilityStatus : false,
      },
    });

    await this.audit.log('HOSPITAL_DONOR_ELIGIBILITY_DECISION', 'DONOR', userId, donorId, {
      hospitalId: hospital.id,
      approved,
    });

    return updated;
  }
}
