import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BloodGroup, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { AuditService } from '../../common/audit/audit.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { HospitalAccessService } from '../../common/rbac/hospital-access.service';
import { PrismaService } from '../../prisma.service';
import { CreateHospitalAdminDto } from './dto/admin/create-hospital-admin.dto';
import { UpdateHospitalAdminDto } from './dto/admin/update-hospital-admin.dto';
import { ApproveDonorEligibilityDto } from './dto/approve-donor-eligibility.dto';
import { DonorSearchDto } from './dto/donor-search.dto';
import { SubmitOfficeUseDto } from './dto/submit-office-use.dto';
import { UpsertHospitalProfileDto } from './dto/upsert-hospital-profile.dto';

const BLOOD_GROUP_CODES = ['O_POS', 'O_NEG', 'A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG'] as const;

@Injectable()
export class HospitalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly hospitalAccess: HospitalAccessService,
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
    const hospitalMembership = await this.hospitalAccess.getHospitalForUser(userId);
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalMembership.id },
      include: { bloodRequests: true, inventoryItems: true },
    });

    if (!hospital) {
      throw new NotFoundException('Hospital profile not found');
    }

    return hospital;
  }

  async searchDonors(userId: string, query: DonorSearchDto) {
    const hospital = await this.hospitalAccess.getHospitalForUser(userId);
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

  async getTypeaheadSuggestions(userId: string, rawQuery: string) {
    const query = rawQuery.trim();
    const normalizedQuery = query.toUpperCase();
    const bloodGroupQuery = BLOOD_GROUP_CODES.includes(normalizedQuery as (typeof BLOOD_GROUP_CODES)[number])
      ? (normalizedQuery as BloodGroup)
      : undefined;

    if (!query) {
      return {
        hospitals: [],
        donors: [],
        bloodGroups: [],
        locations: [],
        emergencyRequests: [],
        inventory: [],
        donationCenters: [],
      };
    }

    await this.getHospitalByUser(userId);

    const [hospitals, donors, requests, inventory] = await Promise.all([
      this.prisma.hospital.findMany({
        where: {
          OR: [
            { hospitalName: { contains: query, mode: 'insensitive' } },
            { location: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true, hospitalName: true, location: true },
        take: 8,
        orderBy: { hospitalName: 'asc' },
      }),
      this.prisma.donor.findMany({
        where: {
          OR: [
            { fullName: { contains: query, mode: 'insensitive' } },
            { location: { contains: query, mode: 'insensitive' } },
            { city: { contains: query, mode: 'insensitive' } },
            { region: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true, fullName: true, bloodGroup: true, location: true },
        take: 8,
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.bloodRequest.findMany({
        where: {
          OR: [
            { patientName: { contains: query, mode: 'insensitive' } },
            { patientCode: { contains: query, mode: 'insensitive' } },
            { hospitalCenterName: { contains: query, mode: 'insensitive' } },
            { emergencyLocation: { contains: query, mode: 'insensitive' } },
            { location: { contains: query, mode: 'insensitive' } },
            { city: { contains: query, mode: 'insensitive' } },
            { region: { contains: query, mode: 'insensitive' } },
            { ward: { contains: query, mode: 'insensitive' } },
            ...(bloodGroupQuery ? [{ bloodGroup: { equals: bloodGroupQuery } }] : []),
          ],
          type: 'EMERGENCY',
        },
        select: {
          id: true,
          bloodGroup: true,
          location: true,
          emergencyLocation: true,
          city: true,
          region: true,
          unitsNeeded: true,
          priority: true,
        },
        take: 8,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.inventoryItem.findMany({
        where: {
          OR: [
            { hospital: { hospitalName: { contains: query, mode: 'insensitive' } } },
            { hospital: { location: { contains: query, mode: 'insensitive' } } },
            ...(bloodGroupQuery ? [{ bloodGroup: { equals: bloodGroupQuery } }] : []),
          ],
        },
        select: {
          id: true,
          bloodGroup: true,
          availableUnits: true,
          hospital: { select: { hospitalName: true, location: true } },
        },
        take: 8,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const bloodGroups = ['O_POS', 'O_NEG', 'A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG'].filter((group) =>
      group.toLowerCase().includes(query.toLowerCase()),
    );

    const locations = Array.from(
      new Set(
        [
          ...hospitals.map((h) => h.location),
          ...donors.map((d) => d.location),
          ...requests.map((r) => r.emergencyLocation ?? r.location),
          ...requests.map((r) => [r.city, r.region].filter(Boolean).join(', ')),
        ].filter(Boolean),
      ),
    ).slice(0, 8);

    return {
      hospitals,
      donors,
      bloodGroups,
      locations,
      emergencyRequests: requests,
      inventory,
      donationCenters: hospitals,
    };
  }

  async listPublicCenters(query: PaginationQueryDto) {
    const skip = query.skip ?? 0;
    const take = Math.min(query.take ?? 50, 100);

    const hospitals = await this.prisma.hospital.findMany({
      where: {
        OR: [{ latitude: { not: null } }, { longitude: { not: null } }, { location: { not: '' } }],
      },
      orderBy: [{ hospitalName: 'asc' }],
      skip,
      take,
      select: {
        id: true,
        hospitalName: true,
        location: true,
        address: true,
        contactPhone: true,
        latitude: true,
        longitude: true,
      },
    });

    return hospitals.map((hospital) => ({
      id: hospital.id,
      hospitalName: hospital.hospitalName,
      location: hospital.location,
      address: hospital.address,
      contactPhone: hospital.contactPhone,
      latitude: hospital.latitude,
      longitude: hospital.longitude,
      mapsUrl:
        hospital.latitude !== null && hospital.longitude !== null
          ? `https://www.google.com/maps?q=${hospital.latitude},${hospital.longitude}`
          : `https://www.google.com/maps?q=${encodeURIComponent(
              `${hospital.hospitalName} ${hospital.address} ${hospital.location}`,
            )}`,
    }));
  }

  listAllForAdmin(query: PaginationQueryDto) {
    const skip = query.skip ?? 0;
    const take = query.take ?? 100;
    return this.prisma.hospital.findMany({
      include: {
        user: { select: { id: true, email: true, role: true, isActive: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
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
      if (md?.hospitalId !== hospital.id) continue;
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
      ? await this.prisma.donor.findMany({ where: { id: { in: donorIds } }, include: { user: { select: { email: true } } } })
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

  async submitOfficeUse(userId: string, donorId: string, officeUseOnly: SubmitOfficeUseDto['officeUseOnly']) {
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

  async approveEligibility(userId: string, donorId: string, approved: ApproveDonorEligibilityDto['approved']) {
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

  private async getHospitalByUser(userId: string) {
    return this.hospitalAccess.getHospitalForUser(userId);
  }
}
