import { Injectable, NotFoundException } from '@nestjs/common';
import { RequestStatus } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { CreateBloodRequestDto } from './dto/create-blood-request.dto';
import { UpdateBloodRequestStatusDto } from './dto/update-blood-request-status.dto';
import { AuditService } from '../../common/audit/audit.service';
import { AlertsService } from '../../common/alerts/alerts.service';

@Injectable()
export class BloodRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly alerts: AlertsService,
  ) {}

  async create(userId: string, dto: CreateBloodRequestDto) {
    const hospital = await this.prisma.hospital.findUnique({ where: { userId } });
    if (!hospital) {
      throw new NotFoundException('Hospital profile not found');
    }

    const matchedDonors = await this.prisma.donor.findMany({
      where: {
        bloodGroup: dto.bloodGroup,
        location: dto.location,
        eligibilityStatus: true,
        availabilityStatus: true,
      },
      select: { id: true, userId: true },
      take: 50,
    });

    const request = await this.prisma.bloodRequest.create({
      data: {
        hospitalId: hospital.id,
        bloodGroup: dto.bloodGroup,
        unitsNeeded: dto.unitsNeeded,
        type: dto.type,
        priority: dto.priority,
        location: dto.location,
        requiredBy: new Date(dto.requiredBy),
        notes: dto.notes,
        status: RequestStatus.MATCHING,
        matchedDonors: { connect: matchedDonors.map((d) => ({ id: d.id })) },
      },
      include: { matchedDonors: true },
    });

    if (dto.type === 'EMERGENCY') {
      this.alerts.notifyCritical('EMERGENCY_REQUEST_CREATED', {
        requestId: request.id,
        bloodGroup: request.bloodGroup,
      });
    }

    await this.audit.log('BLOOD_REQUEST_CREATED', 'BLOOD_REQUEST', userId, request.id, {
      matchedDonorCount: matchedDonors.length,
    });

    await Promise.all(
      matchedDonors.map((donor) =>
        this.prisma.notification.create({
          data: {
            userId: donor.userId,
            bloodRequestId: request.id,
            title: `Urgent ${dto.bloodGroup} blood request`,
            body: `Hospital in ${dto.location} needs ${dto.unitsNeeded} units.`,
            channel: 'IN_APP',
            delivered: true,
          },
        }),
      ),
    );

    return request;
  }

  listAll() {
    return this.prisma.bloodRequest.findMany({
      include: {
        hospital: { select: { hospitalName: true, location: true } },
        matchedDonors: { select: { id: true, fullName: true, bloodGroup: true, location: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(id: string, userId: string, dto: UpdateBloodRequestStatusDto) {
    const request = await this.prisma.bloodRequest.findUnique({ where: { id } });
    if (!request) {
      throw new NotFoundException('Blood request not found');
    }

    const updated = await this.prisma.bloodRequest.update({ where: { id }, data: { status: dto.status } });
    await this.audit.log('BLOOD_REQUEST_STATUS_UPDATED', 'BLOOD_REQUEST', userId, id, dto);
    return updated;
  }
}
