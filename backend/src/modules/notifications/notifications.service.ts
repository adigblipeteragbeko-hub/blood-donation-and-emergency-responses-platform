import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  listForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  markAsDelivered(userId: string, notificationId: string, delivered: boolean) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { delivered },
    });
  }
}
