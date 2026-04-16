import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { UpsertDonorProfileDto } from './dto/upsert-donor-profile.dto';
import { CreateDonationHistoryDto } from './dto/create-donation-history.dto';
import { AuditService } from '../../common/audit/audit.service';

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
}
