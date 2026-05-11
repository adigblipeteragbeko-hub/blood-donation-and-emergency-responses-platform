import { Injectable, NotFoundException } from '@nestjs/common';
import {
  BloodGroup,
  DonorResponseStatus,
  DonorReviewStatus,
  NotificationType,
  Prisma,
  PriorityLevel,
  RequestProgressStatus,
  RequestStatus,
  SecurityEventSeverity,
} from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { ActivityService } from '../../common/activity/activity.service';
import { AuditService } from '../../common/audit/audit.service';
import { AdminDashboardEmergencyQueryDto } from './dto/admin-dashboard-emergency-query.dto';
import { AdminDashboardActivityQueryDto } from './dto/admin-dashboard-activity-query.dto';
import { AdminDashboardDonorReviewQueryDto } from './dto/admin-dashboard-donor-review-query.dto';
import { UpdateDonorReviewDto } from './dto/update-donor-review.dto';
import { AdminDashboardAuditQueryDto } from './dto/admin-dashboard-audit-query.dto';
import { AdminDashboardSearchQueryDto } from './dto/admin-dashboard-search-query.dto';

const ALL_BLOOD_GROUPS: BloodGroup[] = ['O_POS', 'O_NEG', 'A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG'];

@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly audit: AuditService,
  ) {}

  private getDateRange(monthsBack = 6) {
    const start = new Date();
    start.setMonth(start.getMonth() - monthsBack + 1);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private getEmergencyQueueStatus(request: {
    status: RequestStatus;
    trackingStatus: RequestProgressStatus;
    priority: PriorityLevel;
    createdAt: Date;
    donorResponses: { responseStatus: DonorResponseStatus }[];
  }) {
    if (request.status === RequestStatus.CANCELLED || request.trackingStatus === RequestProgressStatus.CANCELLED) {
      return 'cancelled';
    }
    if (request.status === RequestStatus.FULFILLED || request.trackingStatus === RequestProgressStatus.COMPLETED) {
      return 'fulfilled';
    }

    const hasPositiveResponse = request.donorResponses.some(
      (response) =>
        response.responseStatus === DonorResponseStatus.ACCEPTED ||
        response.responseStatus === DonorResponseStatus.DONATED,
    );
    const hasAnyResponse = request.donorResponses.some(
      (response) => response.responseStatus !== DonorResponseStatus.PENDING,
    );

    const ageMinutes = (Date.now() - request.createdAt.getTime()) / 60000;
    if (!hasPositiveResponse && request.priority === PriorityLevel.CRITICAL && ageMinutes >= 20) {
      return 'escalated';
    }
    if (hasAnyResponse) {
      return 'donor_responded';
    }
    if (request.status === RequestStatus.MATCHING || request.trackingStatus === RequestProgressStatus.MATCHED) {
      return 'matching';
    }
    return 'pending';
  }

  private getInventoryHealth(availableUnits: number, lowThreshold: number, criticalThreshold: number) {
    if (availableUnits <= criticalThreshold) {
      return 'critical';
    }
    if (availableUnits <= lowThreshold) {
      return 'low';
    }
    return 'stable';
  }

  async getOverview() {
    const [
      totalDonors,
      activeEmergencyRequests,
      pendingDonorApprovals,
      partnerHospitals,
      inventorySummary,
      completedRequests,
      emergencyResponses,
      lowStockInventory,
    ] = await Promise.all([
      this.prisma.donor.count(),
      this.prisma.bloodRequest.count({
        where: {
          type: 'EMERGENCY',
          trackingStatus: { notIn: [RequestProgressStatus.COMPLETED, RequestProgressStatus.CANCELLED] },
        },
      }),
      this.prisma.donorEligibilityReview.count({
        where: {
          status: {
            in: [
              DonorReviewStatus.SUBMITTED,
              DonorReviewStatus.HOSPITAL_REVIEW,
              DonorReviewStatus.OFFICE_USE_COMPLETED,
            ],
          },
        },
      }),
      this.prisma.partnerHospital.count(),
      this.prisma.inventoryItem.aggregate({ _sum: { availableUnits: true } }),
      this.prisma.bloodRequest.count({
        where: {
          OR: [{ status: RequestStatus.FULFILLED }, { trackingStatus: RequestProgressStatus.COMPLETED }],
        },
      }),
      this.prisma.donorResponse.findMany({
        where: {
          responseStatus: { in: [DonorResponseStatus.ACCEPTED, DonorResponseStatus.DONATED] },
          bloodRequest: { type: 'EMERGENCY' },
        },
        select: {
          responseTime: true,
          bloodRequest: { select: { createdAt: true } },
        },
      }),
      this.prisma.inventoryItem.findMany({
        select: { availableUnits: true, lowThreshold: true, criticalThreshold: true, bloodGroup: true },
      }),
    ]);

    const responseMinutes = emergencyResponses
      .filter((entry) => entry.responseTime)
      .map((entry) => (entry.responseTime!.getTime() - entry.bloodRequest.createdAt.getTime()) / 60000);
    const averageEmergencyResponseTime = responseMinutes.length
      ? Number((responseMinutes.reduce((sum, value) => sum + value, 0) / responseMinutes.length).toFixed(1))
      : 0;

    const lowStockBloodTypes = lowStockInventory.filter((item) =>
      item.availableUnits <= item.lowThreshold,
    ).length;

    return {
      summaryCards: [
        { key: 'total-donors', label: 'Total registered donors', value: totalDonors, tone: 'primary' },
        { key: 'active-emergency-requests', label: 'Active emergency requests', value: activeEmergencyRequests, tone: 'warning' },
        { key: 'pending-donor-approvals', label: 'Pending donor approvals', value: pendingDonorApprovals, tone: 'warning' },
        { key: 'partner-hospitals', label: 'Partner hospitals', value: partnerHospitals, tone: 'neutral' },
        { key: 'blood-units-available', label: 'Blood units available', value: inventorySummary._sum.availableUnits ?? 0, tone: 'success' },
        { key: 'low-stock-blood-types', label: 'Low stock blood types', value: lowStockBloodTypes, tone: 'danger' },
        { key: 'requests-completed', label: 'Requests completed', value: completedRequests, tone: 'success' },
        {
          key: 'average-emergency-response-time',
          label: 'Average emergency response time',
          value: averageEmergencyResponseTime,
          suffix: ' mins',
          tone: 'neutral',
        },
      ],
      quickActions: [
        { label: 'Create Emergency Request', href: '/hospital/request-blood', color: 'primary' },
        { label: 'Add Blood Inventory', href: '/hospital/inventory', color: 'navy' },
        { label: 'Approve Pending Donors', href: '/admin/dashboard#reviews', color: 'amber' },
        { label: 'Broadcast Alert', href: '/admin/website-management', color: 'primary' },
        { label: 'Add Partner Hospital', href: '/admin/website-management', color: 'navy' },
      ],
    };
  }

  async getInventoryMonitoring() {
    const groups = await this.prisma.inventoryItem.groupBy({
      by: ['bloodGroup'],
      _sum: {
        availableUnits: true,
        expiringUnits: true,
        lowThreshold: true,
        criticalThreshold: true,
      },
      _max: { lastUpdated: true },
    });

    return ALL_BLOOD_GROUPS.map((bloodGroup) => {
      const match = groups.find((item) => item.bloodGroup === bloodGroup);
      const availableUnits = match?._sum.availableUnits ?? 0;
      const expiringUnits = match?._sum.expiringUnits ?? 0;
      const lowThreshold = match?._sum.lowThreshold ?? 7;
      const criticalThreshold = match?._sum.criticalThreshold ?? 3;
      return {
        bloodGroup,
        availableUnits,
        expiringUnits,
        status: this.getInventoryHealth(availableUnits, lowThreshold, criticalThreshold),
        lowThreshold,
        criticalThreshold,
        lastUpdated: match?._max.lastUpdated ?? null,
        expiryWarning: expiringUnits > 0,
      };
    });
  }

  async getEmergencyMonitoring(query: AdminDashboardEmergencyQueryDto) {
    const take = query.take ?? 20;
    const skip = query.skip ?? 0;
    const requests = await this.prisma.bloodRequest.findMany({
      where: {
        ...(query.bloodType ? { bloodGroup: query.bloodType } : {}),
        ...(query.urgency ? { priority: query.urgency } : {}),
        ...(query.hospitalId ? { hospitalId: query.hospitalId } : {}),
        ...(query.search
          ? {
              OR: [
                { patientName: { contains: query.search, mode: 'insensitive' } },
                { patientCode: { contains: query.search, mode: 'insensitive' } },
                { hospital: { hospitalName: { contains: query.search, mode: 'insensitive' } } },
                { location: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        hospital: { select: { hospitalName: true } },
        matchedDonors: { select: { id: true } },
        donorResponses: { select: { responseStatus: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    const items = requests
      .map((request) => {
        const queueStatus = this.getEmergencyQueueStatus(request);
        return {
          id: request.id,
          bloodType: request.bloodGroup,
          hospitalName: request.hospital.hospitalName,
          urgencyLevel: request.priority,
          requestStatus: queueStatus,
          rawStatus: request.status,
          trackingStatus: request.trackingStatus,
          timeCreated: request.createdAt,
          matchedDonorsCount: request.matchedDonors.length,
          donorResponseCount: request.donorResponses.filter(
            (response) => response.responseStatus !== DonorResponseStatus.PENDING,
          ).length,
          unitsNeeded: request.unitsNeeded,
          location: request.location,
        };
      })
      .filter((item) => !query.status || item.requestStatus === query.status);

    return {
      total: items.length,
      items: items.slice(skip, skip + take),
      hospitals: await this.prisma.hospital.findMany({
        select: { id: true, hospitalName: true },
        orderBy: { hospitalName: 'asc' },
      }),
    };
  }

  async getActivityFeed(query: AdminDashboardActivityQueryDto) {
    const take = query.take ?? 20;
    const skip = query.skip ?? 0;
    const items = await this.prisma.activityLog.findMany({
      where: {
        ...(query.module ? { module: query.module } : {}),
        ...(query.type ? { type: query.type } : {}),
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    return {
      total: await this.prisma.activityLog.count({
        where: {
          ...(query.module ? { module: query.module } : {}),
          ...(query.type ? { type: query.type } : {}),
        },
      }),
      items,
    };
  }

  async getNotificationCenter() {
    const [inventoryMonitor, pendingReviews, criticalRequests, notifications, hospitals] = await Promise.all([
      this.getInventoryMonitoring(),
      this.prisma.donorEligibilityReview.count({
        where: {
          status: {
            in: [DonorReviewStatus.SUBMITTED, DonorReviewStatus.HOSPITAL_REVIEW, DonorReviewStatus.OFFICE_USE_COMPLETED],
          },
        },
      }),
      this.prisma.bloodRequest.findMany({
        where: {
          type: 'EMERGENCY',
          priority: PriorityLevel.CRITICAL,
          trackingStatus: { notIn: [RequestProgressStatus.COMPLETED, RequestProgressStatus.CANCELLED] },
        },
        include: { donorResponses: { select: { responseStatus: true } }, hospital: { select: { hospitalName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.notification.findMany({
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true } } },
        take: 12,
      }),
      this.prisma.hospital.count(),
    ]);

    const lowStockItems = inventoryMonitor.filter((item) => item.status !== 'stable');
    const expiredItems = inventoryMonitor.filter((item) => item.expiryWarning);
    const failedMatches = criticalRequests.filter((request) =>
      !request.donorResponses.some(
        (response) =>
          response.responseStatus === DonorResponseStatus.ACCEPTED ||
          response.responseStatus === DonorResponseStatus.DONATED,
      ),
    );

    const systemNotifications = [
      ...lowStockItems.map((item) => ({
        id: `low-stock-${item.bloodGroup}`,
        type: 'LOW_STOCK',
        severity: item.status === 'critical' ? 'CRITICAL' : 'WARNING',
        title: `${item.bloodGroup.replace('_', '')} stock is ${item.status}`,
        body: `${item.availableUnits} units available across the network.`,
        createdAt: item.lastUpdated ?? new Date(),
      })),
      ...expiredItems.map((item) => ({
        id: `expiry-${item.bloodGroup}`,
        type: 'EXPIRY_WARNING',
        severity: 'WARNING',
        title: `${item.bloodGroup.replace('_', '')} has expiry warnings`,
        body: `${item.expiringUnits} units are approaching expiry.`,
        createdAt: item.lastUpdated ?? new Date(),
      })),
      ...(pendingReviews > 0
        ? [
            {
              id: 'pending-review-count',
              type: 'PENDING_DONOR_REVIEW',
              severity: 'WARNING',
              title: 'Pending donor eligibility reviews',
              body: `${pendingReviews} donor submissions are waiting for clinical review.`,
              createdAt: new Date(),
            },
          ]
        : []),
      ...(hospitals === 0
        ? [
            {
              id: 'pending-hospital-approval',
              type: 'PENDING_HOSPITAL_APPROVAL',
              severity: 'INFO',
              title: 'No hospital network records found',
              body: 'Add or verify partner hospitals to expand emergency coverage.',
              createdAt: new Date(),
            },
          ]
        : []),
      ...failedMatches.map((request) => ({
        id: `failed-match-${request.id}`,
        type: 'FAILED_DONOR_MATCH',
        severity: 'CRITICAL',
        title: `Failed donor match for ${request.bloodGroup.replace('_', '')}`,
        body: `${request.hospital.hospitalName} still has no accepted donor for a critical request.`,
        createdAt: request.createdAt,
      })),
    ];

    return {
      systemNotifications,
      inbox: notifications.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        body: item.body,
        isRead: item.isRead,
        delivered: item.delivered,
        userEmail: item.user.email,
        createdAt: item.createdAt,
      })),
    };
  }

  async getDonorReviewQueue(query: AdminDashboardDonorReviewQueryDto) {
    const take = query.take ?? 20;
    const skip = query.skip ?? 0;
    const where: Prisma.DonorEligibilityReviewWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.hospitalId ? { selectedHospitalId: query.hospitalId } : {}),
      ...(query.search
        ? {
            OR: [
              { donor: { is: { fullName: { contains: query.search, mode: Prisma.QueryMode.insensitive } } } },
              { donor: { is: { location: { contains: query.search, mode: Prisma.QueryMode.insensitive } } } },
              {
                selectedHospital: {
                  is: { hospitalName: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
                },
              },
            ],
          }
        : {}),
    };

    const [items, total, hospitals] = await Promise.all([
      this.prisma.donorEligibilityReview.findMany({
        where,
        include: {
          donor: {
            select: {
              id: true,
              fullName: true,
              bloodGroup: true,
              location: true,
              phone: true,
              user: { select: { email: true } },
            },
          },
          selectedHospital: {
            select: { id: true, hospitalName: true, location: true },
          },
          reviewer: { select: { email: true } },
        },
        orderBy: [{ status: 'asc' }, { submittedAt: 'desc' }],
        skip,
        take,
      }),
      this.prisma.donorEligibilityReview.count({ where }),
      this.prisma.hospital.findMany({ select: { id: true, hospitalName: true }, orderBy: { hospitalName: 'asc' } }),
    ]);

    return { total, items, hospitals };
  }

  async updateDonorReview(reviewId: string, actorUserId: string, dto: UpdateDonorReviewDto) {
    const existing = await this.prisma.donorEligibilityReview.findUnique({
      where: { id: reviewId },
      include: { donor: true, selectedHospital: true },
    });
    if (!existing) {
      throw new NotFoundException('Donor review record not found');
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const review = await tx.donorEligibilityReview.update({
        where: { id: reviewId },
        data: {
          status: dto.status,
          reviewNotes: dto.reviewNotes ?? existing.reviewNotes,
          officeUseNotes: dto.officeUseNotes ?? existing.officeUseNotes,
          reviewerId: actorUserId,
          hospitalReviewedAt:
            dto.status === DonorReviewStatus.HOSPITAL_REVIEW ? now : existing.hospitalReviewedAt,
          officeCompletedAt:
            dto.status === DonorReviewStatus.OFFICE_USE_COMPLETED ? now : existing.officeCompletedAt,
          approvedAt: dto.status === DonorReviewStatus.APPROVED ? now : existing.approvedAt,
          rejectedAt: dto.status === DonorReviewStatus.REJECTED ? now : existing.rejectedAt,
        },
      });

      await tx.donor.update({
        where: { id: existing.donorId },
        data: {
          eligibilityStatus: dto.status === DonorReviewStatus.APPROVED,
          availabilityStatus: dto.status === DonorReviewStatus.APPROVED,
        },
      });

      return review;
    });

    await this.audit.log(
      'DONOR_REVIEW_STATUS_UPDATED',
      'DONOR_REVIEW',
      actorUserId,
      reviewId,
      {
        donorId: existing.donorId,
        hospitalId: existing.selectedHospitalId,
        status: dto.status,
        reviewNotes: dto.reviewNotes,
        officeUseNotes: dto.officeUseNotes,
      },
      `Donor review moved to ${dto.status}.`,
      {
        module: 'DONOR_REVIEW',
        oldValue: {
          status: existing.status,
          reviewNotes: existing.reviewNotes,
          officeUseNotes: existing.officeUseNotes,
        },
        newValue: dto,
      },
    );

    await this.activity.log({
      actorUserId,
      actorName: existing.donor.fullName,
      type: 'DONOR_REVIEW_UPDATED',
      module: 'DONOR_REVIEW',
      title: `Donor review ${dto.status.toLowerCase()}`,
      description: `${existing.donor.fullName} review was moved to ${dto.status}.`,
      entityType: 'DONOR_REVIEW',
      entityId: reviewId,
      donorId: existing.donorId,
      hospitalId: existing.selectedHospitalId,
    });

    return updated;
  }

  async getAuditLogs(query: AdminDashboardAuditQueryDto) {
    const take = query.take ?? 20;
    const skip = query.skip ?? 0;
    const where = {
      ...(query.action ? { action: query.action } : {}),
      ...(query.userId ? { actorUserId: query.userId } : {}),
      ...(query.module ? { module: query.module } : {}),
      ...((query.from || query.to)
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [items, total, users] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, email: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.auditLog.count({ where }),
      this.prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true, email: true },
        orderBy: { email: 'asc' },
      }),
    ]);

    return { total, items, users };
  }

  async getReports() {
    const start = this.getDateRange(6);
    const [donations, requests, requestByType, donorResponses, hospitals] = await Promise.all([
      this.prisma.donation.findMany({
        where: { donatedAt: { gte: start } },
        select: { donatedAt: true, unitsDonated: true, bloodGroup: true },
        orderBy: { donatedAt: 'asc' },
      }),
      this.prisma.bloodRequest.findMany({
        where: { createdAt: { gte: start } },
        select: { createdAt: true, bloodGroup: true, priority: true, status: true, hospitalId: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.bloodRequest.groupBy({
        by: ['bloodGroup'],
        _count: { _all: true },
      }),
      this.prisma.donorResponse.findMany({
        select: { responseStatus: true, bloodRequestId: true, bloodRequest: { select: { hospitalId: true } } },
      }),
      this.prisma.hospital.findMany({ select: { id: true, hospitalName: true } }),
    ]);

    const monthKey = (value: Date) =>
      `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;

    const donationByMonthMap = new Map<string, number>();
    const requestByMonthMap = new Map<string, number>();
    donations.forEach((item) => {
      donationByMonthMap.set(monthKey(item.donatedAt), (donationByMonthMap.get(monthKey(item.donatedAt)) ?? 0) + item.unitsDonated);
    });
    requests.forEach((item) => {
      requestByMonthMap.set(monthKey(item.createdAt), (requestByMonthMap.get(monthKey(item.createdAt)) ?? 0) + 1);
    });

    const hospitalPerformance = hospitals.map((hospital) => {
      const hospitalRequests = requests.filter((item) => item.hospitalId === hospital.id);
      const completed = hospitalRequests.filter((item) => item.status === RequestStatus.FULFILLED).length;
      return {
        hospitalName: hospital.hospitalName,
        totalRequests: hospitalRequests.length,
        completedRequests: completed,
        completionRate: hospitalRequests.length ? Number(((completed / hospitalRequests.length) * 100).toFixed(1)) : 0,
      };
    });

    return {
      donationsByMonth: Array.from(donationByMonthMap.entries()).map(([month, value]) => ({ month, value })),
      requestTrends: Array.from(requestByMonthMap.entries()).map(([month, value]) => ({ month, value })),
      mostRequestedBloodTypes: requestByType
        .map((item) => ({ bloodType: item.bloodGroup, value: item._count._all }))
        .sort((a, b) => b.value - a.value),
      donorResponseRates: [
        {
          label: 'Accepted',
          value: donorResponses.filter(
            (item) =>
              item.responseStatus === DonorResponseStatus.ACCEPTED ||
              item.responseStatus === DonorResponseStatus.DONATED,
          ).length,
        },
        {
          label: 'Declined',
          value: donorResponses.filter((item) => item.responseStatus === DonorResponseStatus.DECLINED).length,
        },
        {
          label: 'Pending',
          value: donorResponses.filter((item) => item.responseStatus === DonorResponseStatus.PENDING).length,
        },
      ],
      hospitalPerformance,
      shortageTrends: await this.getInventoryMonitoring(),
    };
  }

  async getSecurityMonitoring() {
    const [recentAdminLogins, failedLoginAttempts, suspiciousAccessAttempts, activeSessions] = await Promise.all([
      this.prisma.securityEvent.findMany({
        where: {
          eventType: 'LOGIN_SUCCESS',
          actor: { role: 'ADMIN' },
        },
        include: { actor: { select: { email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      this.prisma.securityEvent.findMany({
        where: { eventType: 'FAILED_LOGIN' },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
      this.prisma.securityEvent.findMany({
        where: {
          OR: [
            { eventType: 'FAILED_ADMIN_ROUTE_ACCESS' },
            { severity: { in: [SecurityEventSeverity.WARNING, SecurityEventSeverity.CRITICAL] } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
      this.prisma.refreshToken.findMany({
        where: {
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: { user: { select: { email: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
    ]);

    return {
      recentAdminLogins,
      failedLoginAttempts,
      suspiciousAccessAttempts,
      activeSessions: activeSessions.map((session) => ({
        id: session.id,
        email: session.user.email,
        role: session.user.role,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
      })),
    };
  }

  async search(query: AdminDashboardSearchQueryDto) {
    const term = query.q;
    const [donors, hospitals, requests, appointments, inventory] = await Promise.all([
      this.prisma.donor.findMany({
        where: {
          OR: [
            { fullName: { contains: term, mode: 'insensitive' } },
            { phone: { contains: term, mode: 'insensitive' } },
            { location: { contains: term, mode: 'insensitive' } },
          ],
        },
        take: 8,
        include: { user: { select: { email: true } } },
      }),
      this.prisma.hospital.findMany({
        where: {
          OR: [
            { hospitalName: { contains: term, mode: 'insensitive' } },
            { location: { contains: term, mode: 'insensitive' } },
            { registrationCode: { contains: term, mode: 'insensitive' } },
          ],
        },
        take: 8,
      }),
      this.prisma.bloodRequest.findMany({
        where: {
          OR: [
            { patientName: { contains: term, mode: 'insensitive' } },
            { patientCode: { contains: term, mode: 'insensitive' } },
            { location: { contains: term, mode: 'insensitive' } },
          ],
        },
        take: 8,
        include: { hospital: { select: { hospitalName: true } } },
      }),
      this.prisma.appointment.findMany({
        where: {
          OR: [
            { notes: { contains: term, mode: 'insensitive' } },
            { donor: { fullName: { contains: term, mode: 'insensitive' } } },
            { hospital: { hospitalName: { contains: term, mode: 'insensitive' } } },
          ],
        },
        take: 8,
        include: {
          donor: { select: { fullName: true } },
          hospital: { select: { hospitalName: true } },
        },
      }),
      this.prisma.inventoryItem.findMany({
        where: {
          OR: [
            { bloodGroup: term as BloodGroup },
            { hospital: { hospitalName: { contains: term, mode: 'insensitive' } } },
          ],
        },
        take: 8,
        include: { hospital: { select: { hospitalName: true } } },
      }),
    ]);

    return { donors, hospitals, requests, appointments, inventory };
  }
}
