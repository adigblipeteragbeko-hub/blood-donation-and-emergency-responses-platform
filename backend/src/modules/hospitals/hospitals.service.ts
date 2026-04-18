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
}
