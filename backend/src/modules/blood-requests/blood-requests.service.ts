import { Injectable, NotFoundException } from '@nestjs/common';
import { BloodGroup, RequestStatus } from '@prisma/client';
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

  private getCompatibleGroups(group: BloodGroup): BloodGroup[] {
    const compatibility: Record<BloodGroup, BloodGroup[]> = {
      O_NEG: ['O_NEG'],
      O_POS: ['O_POS', 'O_NEG'],
      A_NEG: ['A_NEG', 'O_NEG'],
      A_POS: ['A_POS', 'A_NEG', 'O_POS', 'O_NEG'],
      B_NEG: ['B_NEG', 'O_NEG'],
      B_POS: ['B_POS', 'B_NEG', 'O_POS', 'O_NEG'],
      AB_NEG: ['AB_NEG', 'A_NEG', 'B_NEG', 'O_NEG'],
      AB_POS: ['AB_POS', 'AB_NEG', 'A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'O_POS', 'O_NEG'],
    };

    return compatibility[group];
  }

  private compatibilityRank(requested: BloodGroup, donor: BloodGroup): number {
    if (requested === donor) {
      return 0;
    }
    return this.getCompatibleGroups(requested).indexOf(donor) + 1;
  }

  async create(userId: string, dto: CreateBloodRequestDto) {
    const hospital = await this.prisma.hospital.findUnique({ where: { userId } });
    if (!hospital) {
      throw new NotFoundException('Hospital profile not found');
    }

    const donorTarget = dto.type === 'EMERGENCY' || dto.priority === 'CRITICAL' ? 100 : 50;
    const compatibleGroups = this.getCompatibleGroups(dto.bloodGroup);
    const normalizedLocation = dto.location.trim();

    const exactMatchedDonors = await this.prisma.donor.findMany({
      where: {
        bloodGroup: { in: compatibleGroups },
        location: { equals: normalizedLocation, mode: 'insensitive' },
        eligibilityStatus: true,
        availabilityStatus: true,
      },
      select: { id: true, userId: true, bloodGroup: true },
      take: donorTarget,
    });

    const broadenedMatchedDonors =
      exactMatchedDonors.length < donorTarget
        ? await this.prisma.donor.findMany({
            where: {
              bloodGroup: { in: compatibleGroups },
              location: { contains: normalizedLocation, mode: 'insensitive' },
              eligibilityStatus: true,
              availabilityStatus: true,
              id: { notIn: exactMatchedDonors.map((d) => d.id) },
            },
            select: { id: true, userId: true, bloodGroup: true },
            take: donorTarget - exactMatchedDonors.length,
          })
        : [];

    const rankedDonors = [...exactMatchedDonors, ...broadenedMatchedDonors].sort(
      (a, b) => this.compatibilityRank(dto.bloodGroup, a.bloodGroup) - this.compatibilityRank(dto.bloodGroup, b.bloodGroup),
    );

    const matchedDonors = rankedDonors.map((donor) => ({
      id: donor.id,
      userId: donor.userId,
    }));

    if (matchedDonors.length < dto.unitsNeeded && dto.type === 'EMERGENCY') {
      this.alerts.notifyCritical('LOW_MATCH_COVERAGE', {
        requestLocation: normalizedLocation,
        bloodGroup: dto.bloodGroup,
        unitsNeeded: dto.unitsNeeded,
        matchedDonors: matchedDonors.length,
      });
    }

    const request = await this.prisma.bloodRequest.create({
      data: {
        hospitalId: hospital.id,
        bloodGroup: dto.bloodGroup,
        unitsNeeded: dto.unitsNeeded,
        type: dto.type,
        priority: dto.priority,
        location: normalizedLocation,
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
            title: `${dto.priority === 'CRITICAL' ? 'Critical' : 'Urgent'} ${dto.bloodGroup} blood request`,
            body: `Hospital in ${normalizedLocation} needs ${dto.unitsNeeded} units.`,
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
