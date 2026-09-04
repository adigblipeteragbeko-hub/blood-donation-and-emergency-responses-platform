import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BloodGroup, MobilizationResponseStatus, NotificationType } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { RealtimeService } from '../../common/realtime/realtime.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { AuditService } from '../../common/audit/audit.service';
import { RespondMobilizationCampaignDto } from './dto/respond-mobilization-campaign.dto';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly audit: AuditService,
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
      data: { delivered, isRead: delivered },
    });
  }

  async createAndBroadcastNotification(payload: {
    userId: string;
    bloodRequestId?: string;
    campaignId?: string;
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
        campaignId: payload.campaignId,
        title: payload.title,
        body: payload.body,
        channel: payload.channel,
        type: payload.type ?? 'SYSTEM',
        delivered: false,
        isRead: false,
      },
    });

    this.realtime.broadcastNotification({
      notificationId: created.id,
      userId: created.userId,
      title: created.title,
      type: created.type,
      bloodRequestId: created.bloodRequestId,
      campaignId: created.campaignId,
      createdAt: created.createdAt,
    });

    return created;
  }

  async respondToMobilizationCampaign(userId: string, dto: RespondMobilizationCampaignDto) {
    const donor = await this.prisma.donor.findUnique({
      where: { userId },
      select: {
        id: true,
        donorNumber: true,
        fullName: true,
        bloodGroup: true,
        eligibilityStatus: true,
        availabilityStatus: true,
        nextEligibilityDate: true,
        user: { select: { isActive: true, emailVerified: true } },
      },
    });

    if (!donor) {
      throw new ForbiddenException('Only donor accounts can respond to donation mobilization campaigns.');
    }

    const campaign = await this.prisma.donorMobilizationCampaign.findUnique({
      where: { id: dto.campaignId },
      select: { id: true, hospitalId: true, bloodGroup: true, status: true },
    });

    if (!campaign) {
      throw new NotFoundException('Donation mobilization campaign not found.');
    }

    const notification = await this.prisma.notification.findFirst({
      where: {
        userId,
        campaignId: campaign.id,
        type: NotificationType.PROACTIVE_DONATION,
      },
      select: { id: true },
    });

    if (!notification) {
      throw new ForbiddenException('This mobilization campaign was not assigned to your donor account.');
    }

    const now = new Date();
    const actionable =
      donor.user.isActive &&
      donor.user.emailVerified &&
      donor.bloodGroup !== BloodGroup.UNKNOWN &&
      donor.eligibilityStatus &&
      donor.availabilityStatus &&
      (!donor.nextEligibilityDate || donor.nextEligibilityDate <= now);

    if (!actionable && dto.responseStatus !== MobilizationResponseStatus.NOT_AVAILABLE) {
      throw new ForbiddenException('Your donor account is not currently eligible for this mobilization campaign.');
    }

    const response = await this.prisma.donorMobilizationCampaignResponse.upsert({
      where: { campaignId_donorId: { campaignId: campaign.id, donorId: donor.id } },
      create: {
        campaignId: campaign.id,
        donorId: donor.id,
        userId,
        responseStatus: dto.responseStatus,
        notes: dto.notes,
        respondedAt: now,
      },
      update: {
        userId,
        responseStatus: dto.responseStatus,
        notes: dto.notes,
        respondedAt: now,
      },
    });

    await this.prisma.notification.updateMany({
      where: { userId, campaignId: campaign.id },
      data: { delivered: true, isRead: true },
    });

    await this.audit.log('DONOR_MOBILIZATION_RESPONSE', 'DONOR_MOBILIZATION', userId, response.id, {
      campaignId: campaign.id,
      donorId: donor.id,
      donorReference: donor.donorNumber,
      responseStatus: dto.responseStatus,
    });

    await this.realtime.broadcastMobilizationResponse({
      campaignId: campaign.id,
      hospitalId: campaign.hospitalId,
      donorReference: donor.donorNumber,
      bloodGroup: donor.bloodGroup,
      responseStatus: dto.responseStatus,
      respondedAt: response.respondedAt,
      mobilizationType: 'PROACTIVE_DONATION',
    }, campaign.hospitalId);

    return {
      responseStatus: response.responseStatus,
      message:
        response.responseStatus === MobilizationResponseStatus.NOT_AVAILABLE
          ? 'Thank you. The hospital has been informed that you are not available right now.'
          : 'Thank you. Your interest has been sent to the hospital for appointment planning.',
    };
  }
}
