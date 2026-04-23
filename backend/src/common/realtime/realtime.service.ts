import { Injectable } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';

@Injectable()
export class RealtimeService {
  constructor(private readonly gateway: RealtimeGateway) {}

  broadcastEmergencyRequest(payload: unknown) {
    this.gateway.emitEvent('emergency.request.updated', payload);
  }

  broadcastDonorResponse(payload: unknown) {
    this.gateway.emitEvent('donor.response.updated', payload);
  }

  broadcastInventoryUpdate(payload: unknown) {
    this.gateway.emitEvent('inventory.updated', payload);
  }

  broadcastNotification(payload: unknown) {
    this.gateway.emitEvent('notification.created', payload);
  }
}
