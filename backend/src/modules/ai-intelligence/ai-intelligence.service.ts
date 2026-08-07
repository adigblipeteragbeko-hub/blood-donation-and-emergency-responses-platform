import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiConfidenceLevel,
  AiHandoffDestination,
  AiRecommendationType,
  AiRiskLevel,
  AppointmentStatus,
  BloodGroup,
  DonorClinicalStatus,
  InventoryChangeType,
  Prisma,
  RequestStatus,
  RequestType,
  Role,
} from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { getCompatibleDonorGroups } from '../../common/utils/blood-compatibility';
import { PrismaService } from '../../prisma.service';
import {
  AiDonorRecommendationQueryDto,
  AiHandoffDto,
  AiMobilizationPreviewDto,
  AiStockRiskQueryDto,
} from './dto/ai-intelligence.dto';

const ADVISORY_NOTICE =
  'AI recommendations are advisory only. Final operational and clinical decisions remain with authorised Admin and Hospital Admin users.';

type AiUser = { id: string; role: Role };
type AiRecommendationCreate = Omit<Prisma.AiRecommendationUncheckedCreateInput, 'generatedForUserId' | 'generatedForRole'>;

type HospitalScope = {
  hospitalIds?: string[];
  selectedHospitalId?: string;
  hospitalName?: string;
};

@Injectable()
export class AiIntelligenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async overview(user: AiUser, query: AiStockRiskQueryDto) {
    const risks = await this.computeStockRisks(user, query);
    const critical = risks.filter((item) => item.riskLevel === AiRiskLevel.CRITICAL);
    const high = risks.filter((item) => item.riskLevel === AiRiskLevel.HIGH);
    const donorsAvailable = await this.countRecommendedDonors(user, query.hospitalId);
    const openEmergencyRequests = await this.countOpenEmergencyRequests(user, query.hospitalId);
    const expiringUnits = risks.reduce((sum, item) => sum + item.expiringSoonUnits, 0);
    const hospitals = new Set([...critical, ...high].map((item) => item.hospitalId));

    await this.audit.log('AI_OVERVIEW_VIEWED', 'AI_RECOMMENDATION', user.id, undefined, {
      hospitalId: query.hospitalId ?? null,
      resultCount: risks.length,
    }, 'AI intelligence overview viewed.', { module: 'AI_INTELLIGENCE' });

    return {
      advisoryNotice: ADVISORY_NOTICE,
      summary: {
        criticalBloodGroups: critical.length,
        highRiskBloodGroups: high.length,
        hospitalsRequiringAttention: hospitals.size,
        recommendedDonorsAvailable: donorsAvailable,
        expiringUnits,
        openEmergencyRequests,
      },
      insights: this.buildInsights(risks, openEmergencyRequests),
      risks: risks.slice(0, 10),
    };
  }

  async stockRisks(user: AiUser, query: AiStockRiskQueryDto) {
    const risks = await this.computeStockRisks(user, query);
    const skip = Math.max(0, Number(query.skip ?? 0));
    const take = Math.min(Math.max(1, Number(query.take ?? 25)), 100);

    await this.audit.log('AI_STOCK_RISK_VIEWED', 'AI_RECOMMENDATION', user.id, undefined, {
      hospitalId: query.hospitalId ?? null,
      bloodGroup: query.bloodGroup ?? null,
      resultCount: risks.length,
    }, 'AI stock risk table viewed.', { module: 'AI_INTELLIGENCE' });

    return {
      advisoryNotice: ADVISORY_NOTICE,
      total: risks.length,
      items: risks.slice(skip, skip + take),
    };
  }

  async stockRiskDetail(user: AiUser, hospitalId: string, bloodGroup: BloodGroup) {
    const [risk] = await this.computeStockRisks(user, { hospitalId, bloodGroup });
    if (!risk) throw new NotFoundException('No stock risk record found for this hospital and blood group.');
    return {
      ...risk,
      advisoryNotice: ADVISORY_NOTICE,
      detail: {
        factorsConsidered: [
          'Current usable stock',
          'Minimum and critical thresholds',
          'Recent outgoing inventory usage',
          'Open and pending demand',
          'Expiring stock',
          'Upcoming confirmed appointments',
          'Previous stock warnings',
        ],
        calculations: risk.calculations,
        limitations: risk.limitations,
      },
    };
  }

  async donorRecommendations(user: AiUser, query: AiDonorRecommendationQueryDto) {
    const result = await this.buildDonorRecommendations(user, query);
    await this.recordRecommendation(user, {
      hospitalId: result.hospital.id,
      bloodGroup: query.bloodGroup,
      recommendationType: AiRecommendationType.DONOR_MOBILIZATION,
      riskLevel: null,
      confidenceLevel: result.confidenceLevel,
      scoreSummaryJson: { count: result.items.length, radiusKm: result.radiusKm },
      reasonsJson: result.items.map((item) => ({ donorId: item.donorId, reasons: item.reasons })),
      suggestedAction: `Review ${result.items.length} compatible donor recommendation${result.items.length === 1 ? '' : 's'}.`,
      suggestedRecipientCount: result.items.length,
    });
    await this.audit.log('AI_DONOR_RECOMMENDATIONS_GENERATED', 'AI_RECOMMENDATION', user.id, result.hospital.id, {
      bloodGroup: query.bloodGroup,
      donorCount: result.items.length,
      smsEnabledOnly: result.smsEnabledOnly,
    }, 'AI donor recommendations generated.', { module: 'AI_INTELLIGENCE' });
    return result;
  }

  async mobilizationPreview(user: AiUser, dto: AiMobilizationPreviewDto) {
    const recommendations = await this.buildDonorRecommendations(user, {
      hospitalId: dto.hospitalId,
      bloodGroup: dto.bloodGroup,
      radiusKm: dto.radiusKm,
      limit: dto.recipientLimit,
      smsEnabledOnly: 'true',
    });
    const recipientLimit = Math.min(dto.recipientLimit ?? this.defaultDonorLimit, recommendations.items.length);
    const selected = recommendations.items.slice(0, recipientLimit);
    const suggestedMessage = `BloodSOS: ${this.formatBloodGroup(dto.bloodGroup)} blood is currently needed at ${recommendations.hospital.hospitalName}. Please log in to check your eligibility and availability.`;

    await this.recordRecommendation(user, {
      hospitalId: recommendations.hospital.id,
      bloodGroup: dto.bloodGroup,
      recommendationType: AiRecommendationType.CAMPAIGN_SUGGESTION,
      riskLevel: null,
      confidenceLevel: recommendations.confidenceLevel,
      scoreSummaryJson: { matchingDonorsFound: recommendations.items.length, selectedRecipients: selected.length },
      reasonsJson: ['Preview only. No notifications or SMS were sent.'],
      suggestedAction: 'Review donor mobilization recommendation before sending any message.',
      suggestedRecipientCount: selected.length,
    });
    await this.audit.log('AI_MOBILIZATION_PREVIEWED', 'AI_RECOMMENDATION', user.id, recommendations.hospital.id, {
      bloodGroup: dto.bloodGroup,
      matchingDonorsFound: recommendations.items.length,
      selectedRecipients: selected.length,
      sentMessages: false,
    }, 'AI mobilization preview generated without sending messages.', { module: 'AI_INTELLIGENCE' });

    return {
      advisoryNotice: ADVISORY_NOTICE,
      riskLevel: selected.length === 0 ? AiRiskLevel.LOW : AiRiskLevel.HIGH,
      recommendedRecipientCount: selected.length,
      matchingDonorsFound: recommendations.items.length,
      suggestedRadiusKm: recommendations.radiusKm,
      estimatedSmsCredits: selected.length,
      suggestedMessage,
      reason: `Found ${recommendations.items.length} compatible, available donor${recommendations.items.length === 1 ? '' : 's'} within the authorised scope.`,
      donorIds: selected.map((item) => item.donorId),
      sentMessages: false,
    };
  }

  async handoff(user: AiUser, dto: AiHandoffDto) {
    const scope = await this.resolveScope(user, dto.hospitalId);
    if (!scope.selectedHospitalId) {
      throw new BadRequestException('Select a hospital before handing off an AI recommendation.');
    }
    if (user.role === Role.ADMIN && dto.destination !== AiHandoffDestination.DONOR_COMMUNICATIONS) {
      throw new ForbiddenException('Admin AI handoff must go to Admin Donor Communications.');
    }
    if (user.role === Role.HOSPITAL_ADMIN && dto.destination !== AiHandoffDestination.HOSPITAL_MOBILIZATION) {
      throw new ForbiddenException('Hospital Admin AI handoff must use the hospital donor mobilization workflow.');
    }

    const record = await this.recordRecommendation(user, {
      hospitalId: scope.selectedHospitalId,
      bloodGroup: dto.bloodGroup,
      recommendationType: AiRecommendationType.CAMPAIGN_SUGGESTION,
      riskLevel: null,
      confidenceLevel: AiConfidenceLevel.MEDIUM,
      scoreSummaryJson: { donorIdsProvided: dto.donorIds?.length ?? 0, destination: dto.destination },
      reasonsJson: ['User reviewed and handed off the AI recommendation. No messages were sent by AI.'],
      suggestedAction: dto.suggestedMessage ?? null,
      suggestedRecipientCount: dto.donorIds?.length ?? 0,
      handoffDestination: dto.destination,
      acceptedAt: new Date(),
    });

    await this.audit.log('AI_RECOMMENDATION_HANDED_OFF', 'AI_RECOMMENDATION', user.id, record.id, {
      hospitalId: scope.selectedHospitalId,
      bloodGroup: dto.bloodGroup,
      destination: dto.destination,
      donorCount: dto.donorIds?.length ?? 0,
      sentMessages: false,
    }, 'AI recommendation handed off for human review.', { module: 'AI_INTELLIGENCE' });

    return {
      advisoryNotice: ADVISORY_NOTICE,
      handoffId: record.id,
      destination: dto.destination,
      targetRoute: dto.destination === AiHandoffDestination.DONOR_COMMUNICATIONS
        ? '/admin/management?section=donor-communications'
        : '/hospital/dashboard',
      sentMessages: false,
    };
  }

  async history(user: AiUser, query: AiStockRiskQueryDto) {
    const scope = await this.resolveScope(user, query.hospitalId);
    const where: Prisma.AiRecommendationWhereInput = {};
    if (scope.hospitalIds) where.hospitalId = { in: scope.hospitalIds };
    if (scope.selectedHospitalId) where.hospitalId = scope.selectedHospitalId;
    if (query.bloodGroup) where.bloodGroup = query.bloodGroup;
    const skip = Math.max(0, Number(query.skip ?? 0));
    const take = Math.min(Math.max(1, Number(query.take ?? 25)), 100);
    const [total, items] = await Promise.all([
      this.prisma.aiRecommendation.count({ where }),
      this.prisma.aiRecommendation.findMany({
        where,
        include: { hospital: { select: { hospitalName: true } }, generatedFor: { select: { email: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);
    return { advisoryNotice: ADVISORY_NOTICE, total, items };
  }

  private async computeStockRisks(user: AiUser, query: AiStockRiskQueryDto) {
    const scope = await this.resolveScope(user, query.hospitalId);
    const since = this.parseDate(query.dateFrom) ?? this.daysAgo(this.lookbackDays);
    const until = this.parseDate(query.dateTo) ?? new Date();
    const where: Prisma.InventoryItemWhereInput = {};
    if (scope.hospitalIds) where.hospitalId = { in: scope.hospitalIds };
    if (scope.selectedHospitalId) where.hospitalId = scope.selectedHospitalId;
    if (query.bloodGroup) where.bloodGroup = query.bloodGroup;

    const items = await this.prisma.inventoryItem.findMany({
      where,
      include: {
        hospital: { select: { id: true, hospitalName: true } },
        logs: { where: { createdAt: { gte: since, lte: until } }, orderBy: { createdAt: 'desc' } },
      },
      orderBy: [{ hospital: { hospitalName: 'asc' } }, { bloodGroup: 'asc' }],
    });

    const risks = await Promise.all(items.map(async (item) => {
      const [pendingDemand, recentDonations, upcomingAppointments, previousWarnings] = await Promise.all([
        this.prisma.bloodRequest.aggregate({
          where: {
            hospitalId: item.hospitalId,
            bloodGroup: item.bloodGroup,
            status: { in: [RequestStatus.OPEN, RequestStatus.MATCHING] },
            createdAt: { lte: until },
          },
          _sum: { unitsNeeded: true },
        }),
        this.prisma.donation.aggregate({
          where: { hospitalId: item.hospitalId, bloodGroup: item.bloodGroup, createdAt: { gte: since, lte: until } },
          _sum: { unitsDonated: true },
        }),
        this.prisma.appointment.count({
          where: {
            hospitalId: item.hospitalId,
            status: { in: [AppointmentStatus.CONFIRMED, AppointmentStatus.RESCHEDULED] },
            scheduledAt: { gte: new Date(), lte: this.daysFromNow(this.expiryWarningDays) },
          },
        }),
        this.prisma.bloodStockWarning.count({
          where: { hospitalId: item.hospitalId, bloodGroup: item.bloodGroup, createdAt: { gte: since, lte: until } },
        }),
      ]);
      const recentOutgoingUnits = item.logs
        .filter((log) => log.changeType === InventoryChangeType.USED || log.changeType === InventoryChangeType.EXPIRED)
        .reduce((sum, log) => sum + Math.abs(log.unitsChanged), 0);
      const recentIncomingUnits = recentDonations._sum.unitsDonated ?? 0;
      const pendingRequestUnits = pendingDemand._sum.unitsNeeded ?? 0;
      const estimatedNetAvailableUnits = Math.max(0, item.availableUnits - item.expiringUnits - pendingRequestUnits);
      const averageDailyDemand = recentOutgoingUnits / Math.max(1, this.lookbackDays);
      const estimatedDaysRemaining = averageDailyDemand > 0 ? Number((estimatedNetAvailableUnits / averageDailyDemand).toFixed(1)) : null;
      const score = this.riskScore({
        availableUnits: item.availableUnits,
        lowThreshold: item.lowThreshold,
        criticalThreshold: item.criticalThreshold,
        expiringUnits: item.expiringUnits,
        pendingRequestUnits,
        recentOutgoingUnits,
        previousWarnings,
      });
      const riskLevel = this.riskLevel(score, item.availableUnits, item.criticalThreshold, item.lowThreshold);
      const confidenceLevel = recentOutgoingUnits + pendingRequestUnits + recentIncomingUnits + previousWarnings < 3
        ? AiConfidenceLevel.LOW
        : previousWarnings > 0 || recentOutgoingUnits > 0
          ? AiConfidenceLevel.MEDIUM
          : AiConfidenceLevel.LOW;
      const reasons = this.stockReasons(item, pendingRequestUnits, recentOutgoingUnits, estimatedDaysRemaining, previousWarnings);
      const limitations = confidenceLevel === AiConfidenceLevel.LOW
        ? ['Insufficient historical records for trend confidence; this is a rule-based operational assessment.']
        : ['Trend estimate depends on recorded inventory and request activity in the configured lookback window.'];

      return {
        hospitalId: item.hospitalId,
        hospitalName: item.hospital.hospitalName,
        bloodGroup: item.bloodGroup,
        currentUnits: item.availableUnits,
        minimumThreshold: item.lowThreshold,
        criticalThreshold: item.criticalThreshold,
        recentDemandUnits: recentOutgoingUnits,
        pendingRequestUnits,
        expiringSoonUnits: item.expiringUnits,
        incomingAppointmentUnits: upcomingAppointments,
        estimatedNetAvailableUnits,
        estimatedDaysRemaining,
        riskLevel,
        confidenceLevel,
        score,
        reasons,
        recommendedAction: riskLevel === AiRiskLevel.LOW
          ? 'Continue routine monitoring.'
          : `Mobilize eligible ${this.formatBloodGroup(item.bloodGroup)} compatible donors.`,
        advisoryNotice: ADVISORY_NOTICE,
        dataPeriod: { from: since.toISOString(), to: until.toISOString(), lookbackDays: this.lookbackDays },
        limitations,
        calculations: {
          estimatedNetAvailableUnits,
          averageDailyDemand: Number(averageDailyDemand.toFixed(2)),
          riskScore: score,
          previousWarnings,
        },
      };
    }));

    return risks
      .filter((item) => !query.riskLevel || item.riskLevel === query.riskLevel)
      .sort((a, b) => b.score - a.score);
  }

  private async buildDonorRecommendations(user: AiUser, query: AiDonorRecommendationQueryDto) {
    const scope = await this.resolveScope(user, query.hospitalId);
    if (!scope.selectedHospitalId) throw new BadRequestException('Select a hospital for donor recommendations.');
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: scope.selectedHospitalId },
      select: { id: true, hospitalName: true, latitude: true, longitude: true },
    });
    if (!hospital) throw new NotFoundException('Hospital not found.');

    const compatibleGroups = getCompatibleDonorGroups(query.bloodGroup);
    const radiusKm = query.radiusKm ?? this.defaultRadiusKm;
    const minimumScore = query.minimumScore ?? this.minDonorScore;
    const smsEnabledOnly = query.smsEnabledOnly === 'true';
    const donors = await this.prisma.donor.findMany({
      where: {
        bloodGroup: { in: compatibleGroups },
        availabilityStatus: true,
        eligibilityStatus: true,
        user: { isActive: true, emailVerified: true },
        OR: [{ notificationEmailEnabled: true }, { notificationSmsEnabled: true }],
        clinicalRecords: { some: { status: DonorClinicalStatus.APPROVED } },
      },
      include: {
        user: { select: { id: true, email: true } },
        donorMobilizationResponses: { select: { responseStatus: true }, take: 10, orderBy: { createdAt: 'desc' } },
        appointments: { where: { status: { in: [AppointmentStatus.CONFIRMED, AppointmentStatus.SCHEDULED] } }, select: { id: true }, take: 1 },
      },
      take: 500,
    });

    const today = new Date();
    const recommendations = donors
      .map((donor) => {
        if (smsEnabledOnly && !donor.notificationSmsEnabled) return null;
        if (donor.nextEligibilityDate && donor.nextEligibilityDate > today) return null;
        const distanceKm = this.distanceKm(hospital.latitude, hospital.longitude, donor.latitude, donor.longitude);
        if (distanceKm !== null && distanceKm > radiusKm) return null;
        const exact = donor.bloodGroup === query.bloodGroup;
        let score = exact ? 40 : 28;
        score += donor.notificationSmsEnabled ? 8 : 0;
        score += donor.preferredHospitalId === hospital.id ? 10 : 0;
        score += distanceKm === null ? 4 : Math.max(0, 20 - Math.min(20, distanceKm));
        score += donor.lastDonationDate ? Math.min(12, Math.floor((today.getTime() - donor.lastDonationDate.getTime()) / 86_400_000 / 30)) : 6;
        score -= donor.appointments.length > 0 ? 8 : 0;
        const positiveResponses = donor.donorMobilizationResponses.filter((response) => response.responseStatus === 'INTERESTED').length;
        score += Math.min(10, positiveResponses * 3);
        const roundedScore = Math.max(0, Math.min(100, Math.round(score)));
        if (roundedScore < minimumScore) return null;
        return {
          donorId: donor.id,
          donorName: donor.fullName,
          bloodGroup: donor.bloodGroup,
          score: roundedScore,
          priority: roundedScore >= 80 ? 'HIGH' : roundedScore >= 65 ? 'MEDIUM' : 'LOW',
          distanceKm: distanceKm === null ? null : Number(distanceKm.toFixed(1)),
          eligibleNow: true,
          smsEnabled: donor.notificationSmsEnabled,
          reasons: [
            exact ? `Exact ${this.formatBloodGroup(query.bloodGroup)} blood-group match.` : `${this.formatBloodGroup(donor.bloodGroup)} is compatible by platform matching rules.`,
            'Clinical status and donor eligibility are acceptable for operational review.',
            'Donor account is active and currently available.',
            distanceKm === null ? 'No exact distance available, so distance was not over-weighted.' : `Approximately ${distanceKm.toFixed(1)} km from the hospital.`,
            donor.notificationSmsEnabled ? 'SMS consent is enabled.' : 'SMS consent is disabled; use non-SMS review only.',
          ],
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => b.score - a.score)
      .slice(0, query.limit ?? this.defaultDonorLimit);

    return {
      advisoryNotice: ADVISORY_NOTICE,
      hospital,
      bloodGroup: query.bloodGroup,
      compatibleGroups,
      radiusKm,
      smsEnabledOnly,
      confidenceLevel: recommendations.length > 0 ? AiConfidenceLevel.MEDIUM : AiConfidenceLevel.LOW,
      items: recommendations,
    };
  }

  private async resolveScope(user: AiUser, requestedHospitalId?: string): Promise<HospitalScope> {
    if (user.role === Role.ADMIN) {
      return requestedHospitalId ? { selectedHospitalId: requestedHospitalId } : {};
    }
    if (user.role !== Role.HOSPITAL_ADMIN) throw new ForbiddenException('AI Intelligence is restricted to Admin and Hospital Admin users.');
    const hospital = await this.prisma.hospital.findUnique({ where: { userId: user.id }, select: { id: true, hospitalName: true } });
    if (!hospital) throw new ForbiddenException('Hospital Admin account is not linked to a hospital profile.');
    if (requestedHospitalId && requestedHospitalId !== hospital.id) {
      throw new ForbiddenException('Hospital Admin users can only access AI intelligence for their own hospital.');
    }
    return { hospitalIds: [hospital.id], selectedHospitalId: hospital.id, hospitalName: hospital.hospitalName };
  }

  private async recordRecommendation(user: AiUser, data: AiRecommendationCreate) {
    return this.prisma.aiRecommendation.create({
      data: {
        ...data,
        generatedForUserId: user.id,
        generatedForRole: user.role,
      },
    });
  }

  private riskScore(args: {
    availableUnits: number;
    lowThreshold: number;
    criticalThreshold: number;
    expiringUnits: number;
    pendingRequestUnits: number;
    recentOutgoingUnits: number;
    previousWarnings: number;
  }) {
    let score = 0;
    if (args.availableUnits <= args.criticalThreshold) score += 45;
    else if (args.availableUnits <= args.lowThreshold) score += 28;
    score += Math.min(25, args.pendingRequestUnits * 4);
    score += Math.min(15, args.expiringUnits * 3);
    score += args.recentOutgoingUnits > args.lowThreshold ? 10 : 0;
    score += Math.min(10, args.previousWarnings * 2);
    return Math.min(100, score);
  }

  private riskLevel(score: number, currentUnits: number, critical: number, minimum: number) {
    if (currentUnits <= critical || score >= this.criticalRiskScore) return AiRiskLevel.CRITICAL;
    if (currentUnits <= minimum || score >= this.highRiskScore) return AiRiskLevel.HIGH;
    if (score >= 40) return AiRiskLevel.MODERATE;
    return AiRiskLevel.LOW;
  }

  private stockReasons(item: { availableUnits: number; lowThreshold: number; criticalThreshold: number; expiringUnits: number }, pending: number, outgoing: number, daysRemaining: number | null, warnings: number) {
    const reasons: string[] = [];
    if (item.availableUnits <= item.criticalThreshold) reasons.push('Current stock is below or equal to the critical threshold.');
    else if (item.availableUnits <= item.lowThreshold) reasons.push('Current stock is below or equal to the minimum threshold.');
    if (pending > 0) reasons.push(`${pending} unit${pending === 1 ? '' : 's'} are currently requested.`);
    if (item.expiringUnits > 0) reasons.push(`${item.expiringUnits} unit${item.expiringUnits === 1 ? '' : 's'} are marked as expiring soon.`);
    if (outgoing > 0 && daysRemaining !== null) reasons.push(`Recent usage suggests approximately ${daysRemaining} days of cover.`);
    if (warnings > 0) reasons.push('Previous stock warnings exist in the selected lookback period.');
    if (reasons.length === 0) reasons.push('Current records do not show an immediate operational shortage signal.');
    return reasons;
  }

  private buildInsights(risks: Array<{ bloodGroup: BloodGroup; riskLevel: AiRiskLevel; expiringSoonUnits: number }>, openEmergencyRequests: number) {
    const insights: string[] = [];
    const critical = risks.find((item) => item.riskLevel === AiRiskLevel.CRITICAL);
    if (critical) insights.push(`${this.formatBloodGroup(critical.bloodGroup)} has the highest current shortage risk in the selected scope.`);
    const expiring = risks.reduce((sum, item) => sum + item.expiringSoonUnits, 0);
    if (expiring > 0) insights.push(`${expiring} unit${expiring === 1 ? '' : 's'} are marked as expiring soon.`);
    if (openEmergencyRequests > 0) insights.push(`${openEmergencyRequests} open emergency request${openEmergencyRequests === 1 ? '' : 's'} need operational attention.`);
    if (insights.length === 0) insights.push('No high-confidence AI insight is available from the current records.');
    return insights;
  }

  private async countRecommendedDonors(user: AiUser, hospitalId?: string) {
    const scope = await this.resolveScope(user, hospitalId);
    return this.prisma.donor.count({
      where: {
        availabilityStatus: true,
        eligibilityStatus: true,
        user: { isActive: true, emailVerified: true },
        AND: [
          { OR: [{ notificationEmailEnabled: true }, { notificationSmsEnabled: true }] },
          ...(scope.selectedHospitalId ? [{ OR: [{ preferredHospitalId: scope.selectedHospitalId }, { preferredHospitalId: null }] }] : []),
        ],
        clinicalRecords: { some: { status: DonorClinicalStatus.APPROVED } },
      },
    });
  }

  private async countOpenEmergencyRequests(user: AiUser, hospitalId?: string) {
    const scope = await this.resolveScope(user, hospitalId);
    return this.prisma.bloodRequest.count({
      where: {
        type: RequestType.EMERGENCY,
        status: { in: [RequestStatus.OPEN, RequestStatus.MATCHING] },
        ...(scope.selectedHospitalId ? { hospitalId: scope.selectedHospitalId } : {}),
      },
    });
  }

  private distanceKm(originLat: number, originLon: number, lat?: number | null, lon?: number | null) {
    if (lat == null || lon == null) return null;
    const toRad = (value: number) => (value * Math.PI) / 180;
    const earthKm = 6371;
    const dLat = toRad(lat - originLat);
    const dLon = toRad(lon - originLon);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(originLat)) * Math.cos(toRad(lat)) * Math.sin(dLon / 2) ** 2;
    return earthKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private formatBloodGroup(group: BloodGroup) {
    return group.replace('_POS', '+').replace('_NEG', '-');
  }

  private parseDate(value?: string) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private daysAgo(days: number) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
  }

  private daysFromNow(days: number) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  }

  private get lookbackDays() {
    return Number(this.config.get('ai.demandLookbackDays') ?? 30);
  }

  private get expiryWarningDays() {
    return Number(this.config.get('ai.expiryWarningDays') ?? 7);
  }

  private get defaultRadiusKm() {
    return Number(this.config.get('ai.defaultRadiusKm') ?? 20);
  }

  private get defaultDonorLimit() {
    return Number(this.config.get('ai.defaultDonorLimit') ?? 25);
  }

  private get highRiskScore() {
    return Number(this.config.get('ai.highRiskScore') ?? 70);
  }

  private get criticalRiskScore() {
    return Number(this.config.get('ai.criticalRiskScore') ?? 85);
  }

  private get minDonorScore() {
    return Number(this.config.get('ai.minDonorRecommendationScore') ?? 50);
  }
}
