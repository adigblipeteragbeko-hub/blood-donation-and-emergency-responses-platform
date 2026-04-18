import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { UpsertDonorProfileDto } from './dto/upsert-donor-profile.dto';
import { CreateDonationHistoryDto } from './dto/create-donation-history.dto';
import { AuditService } from '../../common/audit/audit.service';
import { CreateDonorAdminDto } from './dto/admin/create-donor-admin.dto';
import { UpdateDonorAdminDto } from './dto/admin/update-donor-admin.dto';
import * as argon2 from 'argon2';
import { Role } from '@prisma/client';

@Injectable()
export class DonorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async upsertProfile(userId: string, dto: UpsertDonorProfileDto) {
    const donor = await this.prisma.donor.upsert({
      where: { userId },
      update: dto,
      create: { ...dto, userId },
      include: { donationHistory: true, appointments: true },
    });

    await this.audit.log('DONOR_PROFILE_UPSERTED', 'DONOR', userId, donor.id, dto);
    return donor;
  }

  async getProfile(userId: string) {
    const donor = await this.prisma.donor.findUnique({
      where: { userId },
      include: { donationHistory: true, appointments: true },
    });

    if (!donor) {
      throw new NotFoundException('Donor profile not found');
    }

    return donor;
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

  listAllForAdmin() {
    return this.prisma.donor.findMany({
      include: {
        user: { select: { id: true, email: true, role: true, isActive: true } },
      },
      orderBy: { createdAt: 'desc' },
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
          fullName: dto.fullName,
          bloodGroup: dto.bloodGroup,
          location: dto.location,
          eligibilityStatus: dto.eligibilityStatus,
          availabilityStatus: dto.availabilityStatus,
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

    const updated = await this.prisma.donor.update({
      where: { id: donorId },
      data: dto,
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
}
