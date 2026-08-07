import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { RealtimeGateway } from './realtime.gateway';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class RealtimeService {
  constructor(
    private readonly gateway: RealtimeGateway,
    private readonly prisma: PrismaService,
  ) {}
  private readonly operationsRoles = [
    Role.ADMIN,
    Role.ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.HOSPITAL_ADMIN,
  ];

  async broadcastEmergencyRequest(
    payload: Record<string, unknown>,
    context: {
      requestId: string;
      hospitalId: string;
      matchedDonorUserIds?: string[];
      matchedHospitalUserIds?: string[];
      isPublicEmergency?: boolean;
    },
  ) {
    const recipientIds = new Set<string>(context.matchedDonorUserIds ?? []);
    (context.matchedHospitalUserIds ?? []).forEach((id) => recipientIds.add(id));

    const [hospitalRecipients, matchedDonorsFromDb] = await Promise.all([
      this.prisma.hospital.findUnique({
        where: { id: context.hospitalId },
        select: {
          userId: true,
        },
      }),
      context.matchedDonorUserIds
        ? Promise.resolve([] as { userId: string }[])
        : this.prisma.donor.findMany({
            where: { donorMatches: { some: { id: context.requestId } } },
            select: { userId: true },
          }),
    ]);

    if (hospitalRecipients?.userId) {
      recipientIds.add(hospitalRecipients.userId);
    }

    matchedDonorsFromDb.forEach((donor) => recipientIds.add(donor.userId));

    recipientIds.forEach((userId) => this.gateway.emitToUser(userId, 'emergency.request.updated', payload));

    this.gateway.emitToRoles([Role.ADMIN], 'emergency.request.updated', payload);

    if (context.isPublicEmergency) {
      this.gateway.emitToPublic('emergency.request.public.updated', this.sanitizeEmergencyPublicPayload(payload));
    }
  }

  broadcastDonorResponse(payload: unknown) {
    this.gateway.emitEvent('donor.response.updated', payload);
  }

  async broadcastMobilizationResponse(payload: Record<string, unknown>, hospitalId: string) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { userId: true },
    });

    if (hospital?.userId) {
      this.gateway.emitToUser(hospital.userId, 'donor.mobilization.response.updated', payload);
    }

    this.gateway.emitToRoles([Role.ADMIN], 'donor.mobilization.response.updated', payload);
  }

  broadcastDonorLocation(payload: unknown) {
    this.gateway.emitToRoles(this.operationsRoles, 'donor.location.updated', payload);
  }

  broadcastDonorSearchInvalidated(payload: {
    donorId: string;
    bloodGroup?: string | null;
    preferredHospitalId?: string | null;
    reason: string;
  }) {
    this.gateway.emitToRoles(this.operationsRoles, 'donor.search.invalidated', {
      donorId: payload.donorId,
      bloodGroup: payload.bloodGroup ?? null,
      preferredHospitalId: payload.preferredHospitalId ?? null,
      reason: payload.reason,
    });
  }

  broadcastInventoryUpdate(payload: unknown) {
    this.gateway.emitToRoles(this.operationsRoles, 'inventory.updated', payload);
  }

  broadcastNotification(payload: { userId?: string } & Record<string, unknown>) {
    if (payload.userId) {
      this.gateway.emitToUser(payload.userId, 'notification.created', payload);
      return;
    }
    this.gateway.emitEvent('notification.created', payload);
  }

  async broadcastAppointmentUpdate(payload: Record<string, unknown>, hospitalId: string) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { userId: true },
    });

    if (hospital?.userId) {
      this.gateway.emitToUser(hospital.userId, 'appointment.updated', payload);
    }

    this.gateway.emitToRoles([Role.ADMIN], 'appointment.updated', payload);
  }

  broadcastWebsiteAnnouncement(payload: unknown) {
    this.gateway.emitToPublic('website.announcement.updated', payload);
  }

  broadcastHospitalMapUpdate(payload: unknown) {
    this.gateway.emitToRoles(this.operationsRoles, 'hospital.map.updated', payload);
    this.gateway.emitToPublic('hospital.map.updated', payload);
  }

  private sanitizeEmergencyPublicPayload(payload: Record<string, unknown>) {
    return {
      requestId: payload.requestId ?? null,
      requestReference: payload.requestReference ?? null,
      status: payload.status ?? null,
      trackingStatus: payload.trackingStatus ?? null,
      bloodGroup: payload.bloodGroup ?? null,
      unitsNeeded: payload.unitsNeeded ?? null,
      priority: payload.priority ?? null,
      hospitalCenterName: payload.hospitalCenterName ?? null,
      location: payload.location ?? null,
      emergencyLocation: payload.emergencyLocation ?? null,
      city: payload.city ?? null,
      region: payload.region ?? null,
      latitude: payload.latitude ?? null,
      longitude: payload.longitude ?? null,
      requiredBy: payload.requiredBy ?? null,
    };
  }
}

