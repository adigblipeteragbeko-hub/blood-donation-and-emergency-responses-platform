import { Injectable } from '@nestjs/common';
import { SecurityEventSeverity } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { AlertsService } from '../alerts/alerts.service';

type SecurityEventInput = {
  actorUserId?: string | null;
  email?: string | null;
  eventType: string;
  severity?: SecurityEventSeverity;
  description: string;
  ipAddress?: string | null;
  device?: string | null;
  userAgent?: string | null;
  metadata?: unknown;
};

@Injectable()
export class SecurityEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsService,
  ) {}

  async log(input: SecurityEventInput) {
    const severity = input.severity ?? SecurityEventSeverity.INFO;
    const event = await this.prisma.securityEvent.create({
      data: {
        actorUserId: input.actorUserId ?? undefined,
        email: input.email ?? undefined,
        eventType: input.eventType,
        severity,
        description: input.description,
        ipAddress: input.ipAddress ?? undefined,
        device: input.device ?? undefined,
        metadata: (input.metadata as object | undefined) ?? undefined,
      },
    });

    const payload = {
      actorUserId: input.actorUserId ?? null,
      email: input.email ?? null,
      ipAddress: input.ipAddress ?? null,
      device: input.device ?? null,
      description: input.description,
      metadata: {
        ...(typeof input.metadata === 'object' && input.metadata !== null ? (input.metadata as object) : {}),
        userAgent: input.userAgent ?? null,
      },
    };

    if (severity === SecurityEventSeverity.CRITICAL) {
      this.alerts.notifyCritical(input.eventType, payload);
    } else if (severity === SecurityEventSeverity.WARNING) {
      this.alerts.notifySecurity(input.eventType, payload);
    }

    return event;
  }
}
