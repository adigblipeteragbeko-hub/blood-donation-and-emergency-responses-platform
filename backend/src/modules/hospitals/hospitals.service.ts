import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { UpsertHospitalProfileDto } from './dto/upsert-hospital-profile.dto';
import { AuditService } from '../../common/audit/audit.service';

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
}
