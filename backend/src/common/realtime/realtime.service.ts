import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { RealtimeGateway } from './realtime.gateway';

@Injectable()
export class RealtimeService {
  constructor(private readonly gateway: RealtimeGateway) {}
  private readonly operationsRoles = [
    Role.SUPER_ADMIN,
    Role.ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.HOSPITAL_STAFF,
    Role.DONOR_REVIEW_OFFICER,
    Role.INVENTORY_OFFICER,
  ];

  broadcastEmergencyRequest(payload: unknown) {
    this.gateway.emitEvent('emergency.request.updated', payload);
  }

  broadcastDonorResponse(payload: unknown) {
    this.gateway.emitEvent('donor.response.updated', payload);
  }

  broadcastDonorLocation(payload: unknown) {
    this.gateway.emitToRoles(this.operationsRoles, 'donor.location.updated', payload);
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

  broadcastWebsiteAnnouncement(payload: unknown) {
    this.gateway.emitToPublic('website.announcement.updated', payload);
  }
}
