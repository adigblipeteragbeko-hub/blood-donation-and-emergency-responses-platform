import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { UpsertHospitalProfileDto } from './dto/upsert-hospital-profile.dto';
import { AuditService } from '../../common/audit/audit.service';
import { CreateHospitalAdminDto } from './dto/admin/create-hospital-admin.dto';
import { UpdateHospitalAdminDto } from './dto/admin/update-hospital-admin.dto';
import * as argon2 from 'argon2';
import { Role, StaffAccountStatus } from '@prisma/client';
import { DonorSearchDto } from './dto/donor-search.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { HospitalAccessService } from '../../common/rbac/hospital-access.service';
import { CreateHospitalDepartmentDto } from './dto/create-hospital-department.dto';
import { UpdateHospitalDepartmentDto } from './dto/update-hospital-department.dto';
import { CreateHospitalStaffDto } from './dto/create-hospital-staff.dto';
import { UpdateHospitalStaffDto } from './dto/update-hospital-staff.dto';
import { UpdateHospitalStaffStatusDto } from './dto/update-hospital-staff-status.dto';
import { HospitalStaffQueryDto } from './dto/hospital-staff-query.dto';

const HOSPITAL_STAFF_ROLES = new Set<Role>([
  Role.HOSPITAL_ADMIN,
  Role.HOSPITAL_STAFF,
  Role.INVENTORY_OFFICER,
  Role.DONOR_REVIEW_OFFICER,
]);

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

  async listPublicCenters(query: PaginationQueryDto) {
    const skip = query.skip ?? 0;
    const take = Math.min(query.take ?? 50, 100);

    const hospitals = await this.prisma.hospital.findMany({
      where: {
        OR: [
          { latitude: { not: null } },
          { longitude: { not: null } },
          { location: { not: '' } },
        ],
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

  async listDepartments(userId: string) {
    const hospital = await this.getHospitalByUser(userId);
    return this.prisma.hospitalDepartment.findMany({
      where: { hospitalId: hospital.id },
      include: {
        _count: { select: { staffMembers: true } },
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async createDepartment(userId: string, dto: CreateHospitalDepartmentDto) {
    const hospital = await this.getHospitalByUser(userId);
    const department = await this.prisma.hospitalDepartment.create({
      data: {
        hospitalId: hospital.id,
        name: dto.name.trim(),
        type: dto.type,
        description: dto.description?.trim() || null,
        isActive: dto.isActive ?? true,
      },
      include: {
        _count: { select: { staffMembers: true } },
      },
    });

    await this.audit.log(
      'HOSPITAL_DEPARTMENT_CREATED',
      'HOSPITAL_DEPARTMENT',
      userId,
      department.id,
      department,
      'Hospital department created',
      {
        module: 'hospital-staff',
      },
    );

    return department;
  }

  async updateDepartment(userId: string, departmentId: string, dto: UpdateHospitalDepartmentDto) {
    const hospital = await this.getHospitalByUser(userId);
    const department = await this.prisma.hospitalDepartment.findUnique({ where: { id: departmentId } });
    if (!department || department.hospitalId !== hospital.id) {
      throw new NotFoundException('Department not found');
    }

    const updated = await this.prisma.hospitalDepartment.update({
      where: { id: departmentId },
      data: {
        name: dto.name?.trim(),
        type: dto.type,
        description: dto.description === undefined ? undefined : dto.description.trim() || null,
        isActive: dto.isActive,
      },
      include: {
        _count: { select: { staffMembers: true } },
      },
    });

    await this.audit.log(
      'HOSPITAL_DEPARTMENT_UPDATED',
      'HOSPITAL_DEPARTMENT',
      userId,
      departmentId,
      updated,
      'Hospital department updated',
      {
        module: 'hospital-staff',
        oldValue: department,
        newValue: updated,
      },
    );

    return updated;
  }

  async listStaff(userId: string, query: HospitalStaffQueryDto) {
    const hospital = await this.getHospitalByUser(userId);
    const skip = query.skip ?? 0;
    const take = Math.min(query.take ?? 50, 100);
    const search = query.search?.trim();

    return this.prisma.staffProfile.findMany({
      where: {
        hospitalId: hospital.id,
        status: query.status,
        departmentId: query.departmentId,
        user: {
          is: {
            role: query.role,
            ...(search
              ? {
                  OR: [{ email: { contains: search, mode: 'insensitive' } }],
                }
              : {}),
          },
        },
        OR: search
          ? [
              { title: { contains: search, mode: 'insensitive' } },
              { employeeCode: { contains: search, mode: 'insensitive' } },
              { department: { is: { name: { contains: search, mode: 'insensitive' } } } },
            ]
          : undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        },
        department: true,
        hospital: {
          select: {
            id: true,
            hospitalName: true,
          },
        },
      },
      orderBy: [{ isDepartmentHead: 'desc' }, { createdAt: 'desc' }],
      skip,
      take,
    });
  }

  async createStaff(userId: string, dto: CreateHospitalStaffDto) {
    const hospital = await this.getHospitalByUser(userId);
    this.assertStaffRole(dto.role);
    await this.assertDepartmentBelongsToHospital(dto.departmentId, hospital.id);

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new BadRequestException('Email already exists');
    }

    const employeeCode = dto.employeeCode?.trim() || this.generateEmployeeCode(hospital.hospitalName, dto.role);

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email.trim().toLowerCase(),
          passwordHash: await argon2.hash(dto.password),
          role: dto.role,
          isActive: true,
          emailVerified: true,
        },
      });

      const donorProfile =
        dto.fullName?.trim() && HOSPITAL_STAFF_ROLES.has(dto.role)
          ? await tx.donor.findFirst({
              where: {
                userId: user.id,
              },
            })
          : null;

      const staffProfile = await tx.staffProfile.create({
        data: {
          userId: user.id,
          hospitalId: hospital.id,
          departmentId: dto.departmentId || null,
          employeeCode,
          title: dto.title.trim(),
          status: dto.status ?? StaffAccountStatus.ACTIVE,
          isDepartmentHead: dto.isDepartmentHead ?? false,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              isActive: true,
            },
          },
          department: true,
        },
      });

      return { ...staffProfile, donorProfile };
    });

    await this.audit.log(
      'HOSPITAL_STAFF_CREATED',
      'STAFF_PROFILE',
      userId,
      created.id,
      created,
      'Hospital staff account created',
      {
        module: 'hospital-staff',
      },
    );

    return created;
  }

  async updateStaff(userId: string, staffId: string, dto: UpdateHospitalStaffDto) {
    const hospital = await this.getHospitalByUser(userId);
    await this.assertDepartmentBelongsToHospital(dto.departmentId, hospital.id);
    if (dto.role) {
      this.assertStaffRole(dto.role);
    }

    const staff = await this.prisma.staffProfile.findUnique({
      where: { id: staffId },
      include: { user: true },
    });

    if (!staff || staff.hospitalId !== hospital.id) {
      throw new NotFoundException('Staff account not found');
    }

    if (dto.email && dto.email !== staff.user.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existing) {
        throw new BadRequestException('Email already exists');
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: staff.userId },
        data: {
          email: dto.email?.trim().toLowerCase(),
          role: dto.role,
          isActive: dto.isActive,
        },
      });

      const staffProfile = await tx.staffProfile.update({
        where: { id: staffId },
        data: {
          departmentId: dto.departmentId === undefined ? undefined : dto.departmentId || null,
          title: dto.title?.trim(),
          status: dto.status,
          isDepartmentHead: dto.isDepartmentHead,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              isActive: true,
            },
          },
          department: true,
        },
      });

      return { ...staffProfile, user };
    });

    await this.audit.log(
      'HOSPITAL_STAFF_UPDATED',
      'STAFF_PROFILE',
      userId,
      staffId,
      dto,
      'Hospital staff account updated',
      {
        module: 'hospital-staff',
        oldValue: staff,
        newValue: updated,
      },
    );

    return updated;
  }

  async updateStaffStatus(userId: string, staffId: string, dto: UpdateHospitalStaffStatusDto) {
    return this.updateStaff(userId, staffId, {
      status: dto.status,
      isActive: dto.isActive,
    });
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
          role: Role.HOSPITAL_ADMIN,
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
    return this.hospitalAccess.getHospitalForUser(userId);
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

  private assertStaffRole(role: Role) {
    if (!HOSPITAL_STAFF_ROLES.has(role)) {
      throw new BadRequestException('Invalid hospital staff role selection.');
    }
  }

  private async assertDepartmentBelongsToHospital(departmentId: string | null | undefined, hospitalId: string) {
    if (!departmentId) {
      return;
    }
    const department = await this.prisma.hospitalDepartment.findUnique({ where: { id: departmentId } });
    if (!department || department.hospitalId !== hospitalId) {
      throw new BadRequestException('Department does not belong to this hospital.');
    }
  }

  private generateEmployeeCode(hospitalName: string, role: Role) {
    const hospitalCode = hospitalName
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 4)
      .toUpperCase()
      .padEnd(4, 'X');
    const roleCode = role
      .split('_')
      .map((segment) => segment[0])
      .join('')
      .slice(0, 3)
      .toUpperCase();
    const random = Math.floor(1000 + Math.random() * 9000);
    return `${hospitalCode}-${roleCode}-${random}`;
  }
}
