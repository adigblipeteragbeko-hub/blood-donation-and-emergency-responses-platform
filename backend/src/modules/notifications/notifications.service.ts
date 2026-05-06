import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { RealtimeService } from '../../common/realtime/realtime.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  listForUser(userId: string, query: PaginationQueryDto) {
    const skip = query.skip ?? 0;
    const take = query.take ?? 100;
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  markAsDelivered(userId: string, notificationId: string, delivered: boolean) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { delivered },
    });
  }

  async createAndBroadcastNotification(payload: {
    userId: string;
    bloodRequestId?: string;
    title: string;
    body: string;
    channel: string;
    type?: NotificationType;
    delivered?: boolean;
  }) {
    const created = await this.prisma.notification.create({
      data: {
        userId: payload.userId,
        bloodRequestId: payload.bloodRequestId,
        title: payload.title,
        body: payload.body,
        channel: payload.channel,
        type: payload.type ?? 'SYSTEM',
        delivered: payload.delivered ?? false,
      },
    });

    this.realtime.broadcastNotification({
      notificationId: created.id,
      userId: created.userId,
      title: created.title,
      createdAt: created.createdAt,
    });

    return created;
  }
}
