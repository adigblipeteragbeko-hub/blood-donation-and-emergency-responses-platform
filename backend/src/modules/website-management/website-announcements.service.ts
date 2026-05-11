import { Injectable, NotFoundException } from '@nestjs/common';
import { AwarenessPost, PriorityLevel, WebsiteAlert, WebsiteAnnouncementType } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { RealtimeService } from '../../common/realtime/realtime.service';

type AnnouncementFeedItem = {
  id: string;
  type: WebsiteAnnouncementType;
  title: string;
  message: string;
  href: string;
  priority: PriorityLevel;
  badge: string | null;
  isPublished: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  isRead?: boolean;
};

@Injectable()
export class WebsiteAnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  private readonly systemAnnouncementSourceKey = 'system:support-channels';

  private mapAnnouncement<T extends { createdAt: Date; updatedAt: Date; expiresAt: Date | null }>(
    announcement: T,
  ) {
    return {
      ...announcement,
      expiresAt: announcement.expiresAt?.toISOString() ?? null,
      createdAt: announcement.createdAt.toISOString(),
      updatedAt: announcement.updatedAt.toISOString(),
    };
  }

  private buildAlertSourceKey(alertId: string) {
    return `website-alert:${alertId}`;
  }

  private buildAwarenessSourceKey(postId: string) {
    return `awareness-post:${postId}`;
  }

  private getAlertBadge(alert: WebsiteAlert) {
    if (alert.isSticky && alert.isScrolling) return 'Sticky + Scrolling';
    if (alert.isSticky) return 'Sticky';
    if (alert.isScrolling) return 'Scrolling';
    return 'Live';
  }

  async ensureAnnouncementsSeeded() {
    const [activeAlerts, awarenessPosts] = await Promise.all([
      this.prisma.websiteAlert.findMany(),
      this.prisma.awarenessPost.findMany(),
    ]);

    await Promise.all([
      ...activeAlerts.map((alert) => this.syncAlertAnnouncement(alert, false)),
      ...awarenessPosts.map((post) => this.syncAwarenessAnnouncement(post, false)),
      this.upsertSystemAnnouncement(false),
    ]);
  }

  async listPublicAnnouncements() {
    await this.ensureAnnouncementsSeeded();

    const announcements = await this.prisma.websiteAnnouncement.findMany({
      where: {
        isPublished: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
      take: 12,
    });

    return announcements.map((announcement) => this.mapAnnouncement(announcement));
  }

  async listAnnouncementsForUser(userId: string) {
    await this.ensureAnnouncementsSeeded();

    const announcements = await this.prisma.websiteAnnouncement.findMany({
      where: {
        isPublished: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
      take: 12,
      include: {
        reads: {
          where: { userId },
          select: { id: true },
        },
      },
    });

    return announcements.map((announcement) => ({
      ...this.mapAnnouncement(announcement),
      isRead: announcement.reads.length > 0,
    }));
  }

  async markAsRead(userId: string, announcementId: string) {
    const announcement = await this.prisma.websiteAnnouncement.findFirst({
      where: {
        id: announcementId,
        isPublished: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }

    await this.prisma.websiteAnnouncementRead.upsert({
      where: {
        announcementId_userId: {
          announcementId,
          userId,
        },
      },
      update: { readAt: new Date() },
      create: { announcementId, userId },
    });

    return { id: announcementId, isRead: true };
  }

  async markAllAsRead(userId: string) {
    const announcements = await this.prisma.websiteAnnouncement.findMany({
      where: {
        isPublished: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true },
    });

    if (!announcements.length) {
      return { updatedCount: 0 };
    }

    const now = new Date();
    await this.prisma.websiteAnnouncementRead.createMany({
      data: announcements.map((announcement) => ({
        announcementId: announcement.id,
        userId,
        readAt: now,
      })),
      skipDuplicates: true,
    });

    return { updatedCount: announcements.length };
  }

  async syncAlertAnnouncement(alert: WebsiteAlert, broadcast = true) {
    const announcement = await this.prisma.websiteAnnouncement.upsert({
      where: { sourceKey: this.buildAlertSourceKey(alert.id) },
      update: {
        sourceType: WebsiteAnnouncementType.ALERT,
        title: alert.title,
        message: alert.message,
        href: '/emergency-requests',
        priority: alert.urgencyLevel,
        badge: this.getAlertBadge(alert),
        isPublished: alert.isActive,
        expiresAt: alert.expiresAt,
      },
      create: {
        sourceKey: this.buildAlertSourceKey(alert.id),
        sourceType: WebsiteAnnouncementType.ALERT,
        title: alert.title,
        message: alert.message,
        href: '/emergency-requests',
        priority: alert.urgencyLevel,
        badge: this.getAlertBadge(alert),
        isPublished: alert.isActive,
        expiresAt: alert.expiresAt,
      },
    });

    if (broadcast) {
      this.realtime.broadcastWebsiteAnnouncement({
        action: 'upsert',
        announcement: this.mapAnnouncement(announcement),
      });
    }

    return announcement;
  }

  async removeAlertAnnouncement(alertId: string, broadcast = true) {
    const deleted = await this.prisma.websiteAnnouncement.deleteMany({
      where: { sourceKey: this.buildAlertSourceKey(alertId) },
    });

    if (broadcast && deleted.count > 0) {
      this.realtime.broadcastWebsiteAnnouncement({
        action: 'delete',
        sourceKey: this.buildAlertSourceKey(alertId),
      });
    }
  }

  async syncAwarenessAnnouncement(post: AwarenessPost, broadcast = true) {
    const announcement = await this.prisma.websiteAnnouncement.upsert({
      where: { sourceKey: this.buildAwarenessSourceKey(post.id) },
      update: {
        sourceType: WebsiteAnnouncementType.AWARENESS,
        title: post.title,
        message: post.content,
        href: '/about',
        priority: PriorityLevel.MEDIUM,
        badge: post.category,
        isPublished: post.isPublished,
        expiresAt: null,
      },
      create: {
        sourceKey: this.buildAwarenessSourceKey(post.id),
        sourceType: WebsiteAnnouncementType.AWARENESS,
        title: post.title,
        message: post.content,
        href: '/about',
        priority: PriorityLevel.MEDIUM,
        badge: post.category,
        isPublished: post.isPublished,
        expiresAt: null,
      },
    });

    if (broadcast) {
      this.realtime.broadcastWebsiteAnnouncement({
        action: 'upsert',
        announcement: this.mapAnnouncement(announcement),
      });
    }

    return announcement;
  }

  async removeAwarenessAnnouncement(postId: string, broadcast = true) {
    const deleted = await this.prisma.websiteAnnouncement.deleteMany({
      where: { sourceKey: this.buildAwarenessSourceKey(postId) },
    });

    if (broadcast && deleted.count > 0) {
      this.realtime.broadcastWebsiteAnnouncement({
        action: 'delete',
        sourceKey: this.buildAwarenessSourceKey(postId),
      });
    }
  }

  async upsertSystemAnnouncement(broadcast = true) {
    const footer = await this.prisma.websiteFooterSettings.findUnique({
      where: { singletonKey: 'default' },
    });

    const announcement = await this.prisma.websiteAnnouncement.upsert({
      where: { sourceKey: this.systemAnnouncementSourceKey },
      update: {
        sourceType: WebsiteAnnouncementType.SYSTEM,
        title: 'Support channels are live',
        message: `Emergency contacts and partner hospitals are monitored. Reach support at ${footer?.supportEmail ?? 'support@bloodresponse.local'}.`,
        href: '/contact',
        priority: PriorityLevel.LOW,
        badge: 'System',
        isPublished: true,
        expiresAt: null,
      },
      create: {
        sourceKey: this.systemAnnouncementSourceKey,
        sourceType: WebsiteAnnouncementType.SYSTEM,
        title: 'Support channels are live',
        message: `Emergency contacts and partner hospitals are monitored. Reach support at ${footer?.supportEmail ?? 'support@bloodresponse.local'}.`,
        href: '/contact',
        priority: PriorityLevel.LOW,
        badge: 'System',
        isPublished: true,
        expiresAt: null,
      },
    });

    if (broadcast) {
      this.realtime.broadcastWebsiteAnnouncement({
        action: 'upsert',
        announcement: this.mapAnnouncement(announcement),
      });
    }

    return announcement;
  }
}
