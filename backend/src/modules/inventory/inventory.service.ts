import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AppointmentStatus,
  BloodGroup,
  DonorClinicalStatus,
  HospitalBloodTransferStatus,
  InventoryChangeType,
  MobilizationCampaignStatus,
  MobilizationResponseStatus,
  NotificationType,
  PriorityLevel,
  RequestStatus,
  Role,
  SmsPurpose,
  StockWarningLevel,
} from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { CreateInventoryLogDto } from './dto/create-inventory-log.dto';
import { UpsertInventoryDto } from './dto/upsert-inventory.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { AuditService } from '../../common/audit/audit.service';
import { AlertsService } from '../../common/alerts/alerts.service';
import { RealtimeService } from '../../common/realtime/realtime.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { HospitalAccessService } from '../../common/rbac/hospital-access.service';
import { getCompatibleDonorGroups } from '../../common/utils/blood-compatibility';
import { SmsService } from '../sms/sms.service';

const CORE_BLOOD_GROUPS = [
  BloodGroup.O_POS,
  BloodGroup.O_NEG,
  BloodGroup.A_POS,
  BloodGroup.A_NEG,
  BloodGroup.B_POS,
  BloodGroup.B_NEG,
  BloodGroup.AB_POS,
  BloodGroup.AB_NEG,
] as const;
const USAGE_HISTORY_WINDOW_DAYS = 60;
const EXPIRY_WINDOW_DAYS = 14;
const INVENTORY_STALE_HOURS = 24;
const MOBILIZATION_DUPLICATE_WINDOW_MINUTES = 30;

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly alerts: AlertsService,
    private readonly realtime: RealtimeService,
    private readonly hospitalAccess: HospitalAccessService,
    private readonly smsService: SmsService,
  ) {}

  private async getHospitalForUser(userId: string) {
    return this.hospitalAccess.getHospitalForUser(userId);
  }

  private calculateUnits(previousUnits: number, unitsChanged: number, changeType: InventoryChangeType): number {
    if (changeType === InventoryChangeType.ADDED) {
      return previousUnits + unitsChanged;
    }

    if (changeType === InventoryChangeType.USED || changeType === InventoryChangeType.EXPIRED) {
      return previousUnits - unitsChanged;
    }

    return unitsChanged;
  }

  private getCriticalThreshold(bloodGroup: string): number {
    if (bloodGroup === 'O_NEG') {
      return 12;
    }
    if (bloodGroup === 'B_NEG' || bloodGroup === 'AB_NEG') {
      return 5;
    }
    return 8;
  }

  private getDefaultMinimumThreshold(bloodGroup: string): number {
    return Math.max(this.getCriticalThreshold(bloodGroup) * 2, 7);
  }

  private toRiskLevel(score: number) {
    if (score >= 75) return 'Critical';
    if (score >= 50) return 'High';
    if (score >= 25) return 'Moderate';
    return 'Low';
  }

  private mapStatusToWarningLevel(status: string) {
    if (status === 'Critical') return StockWarningLevel.CRITICAL;
    if (status === 'Low Stock') return StockWarningLevel.LIKELY_SHORTAGE;
    if (status === 'Monitor') return StockWarningLevel.WATCH;
    return StockWarningLevel.STABLE;
  }

  private formatBloodGroup(value: BloodGroup | string) {
    return String(value).replace('_POS', '+').replace('_NEG', '-');
  }

  private formatWarningLevel(value: StockWarningLevel | string) {
    return String(value)
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private clampScore(value: number) {
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  private calculateInventoryHealth(args: {
    bloodGroup: BloodGroup;
    currentUnits: number;
    minimumStockLevel: number;
    criticalStockLevel: number;
    averageDailyUsage: number | null;
    usageHistoryCount: number;
    unitsExpiringSoon: number;
    activeRequestedUnits: number;
    urgentRequestedUnits: number;
    incomingTransferUnits: number;
    scheduledDonationUnits: number;
    exactAvailableDonors: number;
    compatibleAvailableDonors: number;
    recentIncomingUnits: number;
    recentOutgoingUnits: number;
    lastUpdatedAt: Date | null;
  }) {
    const currentUnits = Math.max(0, Number(args.currentUnits) || 0);
    const activeDemand = Math.max(0, Number(args.activeRequestedUnits) || 0);
    const urgentDemand = Math.max(0, Number(args.urgentRequestedUnits) || 0);
    const expiringSoon = Math.max(0, Number(args.unitsExpiringSoon) || 0);
    const incomingSupply =
      Math.max(0, Number(args.incomingTransferUnits) || 0) +
      Math.max(0, Number(args.scheduledDonationUnits) || 0);
    const usableUnits = Math.max(0, currentUnits - expiringSoon - activeDemand);
    const forecastedAvailableUnits = Math.max(0, usableUnits + incomingSupply);
    const demandRatio = currentUnits > 0 ? activeDemand / currentUnits : activeDemand > 0 ? Number.POSITIVE_INFINITY : 0;
    const expiryRatio = currentUnits > 0 ? expiringSoon / currentUnits : expiringSoon > 0 ? 1 : 0;
    const urgentDemandUncovered = urgentDemand > usableUnits;

    let status = 'Healthy';
    if (
      currentUnits <= 0 ||
      usableUnits <= 0 ||
      currentUnits <= args.criticalStockLevel ||
      urgentDemandUncovered
    ) {
      status = 'Critical';
    } else if (
      currentUnits < args.minimumStockLevel ||
      currentUnits - expiringSoon < args.minimumStockLevel
    ) {
      status = 'Low Stock';
    } else if (demandRatio >= 0.5 || expiryRatio >= 0.25 || args.compatibleAvailableDonors === 0 || args.recentOutgoingUnits > args.recentIncomingUnits * 2) {
      status = 'Monitor';
    }

    let forecastStatus = 'Healthy';
    if (forecastedAvailableUnits <= 0 || forecastedAvailableUnits <= args.criticalStockLevel) {
      forecastStatus = 'Critical';
    } else if (forecastedAvailableUnits < args.minimumStockLevel) {
      forecastStatus = 'Low Stock';
    } else if (demandRatio >= 0.5 || expiryRatio >= 0.25 || args.compatibleAvailableDonors === 0) {
      forecastStatus = 'Monitor';
    }

    let stockRisk = 0;
    if (usableUnits <= 0) stockRisk = 40;
    else if (currentUnits <= args.criticalStockLevel) stockRisk = 35 + Math.round((1 - currentUnits / Math.max(args.criticalStockLevel, 1)) * 5);
    else if (currentUnits < args.minimumStockLevel) stockRisk = 20 + Math.round((1 - currentUnits / Math.max(args.minimumStockLevel, 1)) * 14);
    else stockRisk = Math.min(19, Math.round((args.minimumStockLevel / Math.max(currentUnits, 1)) * 12));

    let demandRisk = 0;
    if (urgentDemand > usableUnits) demandRisk = 25;
    else if (activeDemand > 0) demandRisk = Math.min(25, Math.round((activeDemand / Math.max(currentUnits, 1)) * 25));

    const expiryRisk = Math.min(15, Math.round(expiryRatio * 15));
    let donorRisk = 0;
    if (status !== 'Healthy') {
      donorRisk = args.compatibleAvailableDonors === 0 ? 15 : args.compatibleAvailableDonors < 3 ? 9 : args.compatibleAvailableDonors < 8 ? 4 : 0;
    }
    let riskScore = this.clampScore(stockRisk + demandRisk + expiryRisk + donorRisk);
    if (status === 'Critical') riskScore = Math.max(riskScore, 75);
    else if (status === 'Low Stock') riskScore = Math.max(riskScore, 50);
    else if (status === 'Monitor') riskScore = Math.max(riskScore, 25);
    else riskScore = Math.min(riskScore, 24);

    const stale = !args.lastUpdatedAt || Date.now() - args.lastUpdatedAt.getTime() > INVENTORY_STALE_HOURS * 60 * 60_000;
    const riskLevel = this.toRiskLevel(riskScore);
    const dataFreshness = stale ? 'Stale' : 'Fresh';
    const explanationParts = [
      `${status} because there are ${usableUnits} usable unit${usableUnits === 1 ? '' : 's'}`,
      `current stock is ${currentUnits}`,
      `minimum threshold is ${args.minimumStockLevel}`,
      `critical threshold is ${args.criticalStockLevel}`,
      activeDemand > 0 ? `${activeDemand} active demand unit${activeDemand === 1 ? '' : 's'} is included as expected demand` : 'no active demand is currently counted',
      urgentDemand > 0 ? `${urgentDemand} urgent unit${urgentDemand === 1 ? '' : 's'} require immediate cover` : null,
      expiringSoon > 0 ? `${expiringSoon} unit${expiringSoon === 1 ? '' : 's'} expire within ${EXPIRY_WINDOW_DAYS} days` : 'expiry risk is low',
      incomingSupply > 0
        ? `forecasted available stock is ${forecastedAvailableUnits} after ${args.incomingTransferUnits} incoming transfer unit${args.incomingTransferUnits === 1 ? '' : 's'} and ${args.scheduledDonationUnits} expected donation unit${args.scheduledDonationUnits === 1 ? '' : 's'}`
        : 'no reliable incoming supply is currently counted',
      `${args.exactAvailableDonors} exact and ${args.compatibleAvailableDonors} compatible available donor${args.compatibleAvailableDonors === 1 ? '' : 's'} found`,
      stale ? 'inventory data is stale' : 'inventory data is fresh',
    ].filter(Boolean);

    return {
      usableUnits,
      forecastedAvailableUnits,
      forecastStatus,
      riskScore,
      riskLevel,
      status,
      level: this.mapStatusToWarningLevel(status),
      dataFreshness,
      explanation: `${this.formatBloodGroup(args.bloodGroup)}: ${explanationParts.join(', ')}.`,
      riskFactors: [
        `Stock level risk: ${stockRisk}/40`,
        `Demand risk: ${demandRisk}/25`,
        `Expiry risk: ${expiryRisk}/15`,
        `Donor availability risk: ${donorRisk}/15`,
        `Forecasted available stock after reliable incoming supply: ${forecastedAvailableUnits}`,
      ],
    };
  }

  private toRad(value: number) {
    return (value * Math.PI) / 180;
  }

  private distanceKm(fromLat: number, fromLng: number, toLat: number, toLng: number) {
    const earthRadiusKm = 6371;
    const dLat = this.toRad(toLat - fromLat);
    const dLng = this.toRad(toLng - fromLng);
    const lat1 = this.toRad(fromLat);
    const lat2 = this.toRad(toLat);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private async findEligibleMobilizationDonors(hospital: { id: string; latitude: number | null; longitude: number | null }, bloodGroup: BloodGroup, radiusKm = 25) {
    const compatibleGroups = getCompatibleDonorGroups(bloodGroup);
    const donors = await this.prisma.donor.findMany({
      where: {
        bloodGroup: { in: compatibleGroups },
        NOT: { bloodGroup: BloodGroup.UNKNOWN },
        eligibilityStatus: true,
        availabilityStatus: true,
        locationSharingEnabled: true,
        user: { isActive: true, emailVerified: true },
        clinicalRecords: { some: { status: DonorClinicalStatus.APPROVED } },
        OR: [{ nextEligibilityDate: null }, { nextEligibilityDate: { lte: new Date() } }],
      },
      select: {
        id: true,
        donorNumber: true,
        fullName: true,
        userId: true,
        bloodGroup: true,
        latitude: true,
        longitude: true,
      },
      take: 250,
    });

    if (typeof hospital.latitude !== 'number' || typeof hospital.longitude !== 'number') {
      return donors.slice(0, 100);
    }

    return donors
      .map((donor) => ({
        ...donor,
        distanceKm:
          typeof donor.latitude === 'number' && typeof donor.longitude === 'number'
            ? this.distanceKm(hospital.latitude!, hospital.longitude!, donor.latitude, donor.longitude)
            : null,
      }))
      .filter((donor) => donor.distanceKm === null || donor.distanceKm <= radiusKm)
      .sort((a, b) => (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY))
      .slice(0, 100);
  }

  private async recordMeaningfulWarningTransitions(warnings: Array<{
    hospitalId: string;
    bloodGroup: BloodGroup;
    level: StockWarningLevel;
    currentUnits: number;
    activeDemandUnits: number;
    expiringUnits: number;
    incomingTransferUnits: number;
    scheduledDonationUnits: number;
    explanation: string;
    recommendedAction?: string | null;
  }>) {
    const scopedWarnings = warnings.filter((warning) => warning.hospitalId !== 'unscoped');
    const writes = [];

    for (const warning of scopedWarnings) {
      const latest = await this.prisma.bloodStockWarning.findFirst({
        where: { hospitalId: warning.hospitalId, bloodGroup: warning.bloodGroup },
        orderBy: { createdAt: 'desc' },
        select: {
          level: true,
          currentUnits: true,
          activeDemandUnits: true,
          expiringUnits: true,
          incomingTransferUnits: true,
          scheduledDonationUnits: true,
        },
      });

      const changed =
        !latest ||
        latest.level !== warning.level ||
        latest.currentUnits !== warning.currentUnits ||
        latest.activeDemandUnits !== warning.activeDemandUnits ||
        latest.expiringUnits !== warning.expiringUnits ||
        latest.incomingTransferUnits !== warning.incomingTransferUnits ||
        latest.scheduledDonationUnits !== warning.scheduledDonationUnits;

      if (!changed) {
        continue;
      }

      writes.push(
        this.prisma.bloodStockWarning.create({
          data: {
            hospitalId: warning.hospitalId,
            bloodGroup: warning.bloodGroup,
            level: warning.level,
            currentUnits: warning.currentUnits,
            estimatedDaysOfCover: null,
            activeDemandUnits: warning.activeDemandUnits,
            expiringUnits: warning.expiringUnits,
            incomingTransferUnits: warning.incomingTransferUnits,
            scheduledDonationUnits: warning.scheduledDonationUnits,
            explanation: warning.explanation,
            recommendedAction: warning.recommendedAction,
          },
        }),
      );
    }

    if (writes.length > 0) {
      await this.prisma.$transaction(writes);
    }
  }

  private async selectMobilizationDonors(
    hospital: { id: string; latitude: number | null; longitude: number | null },
    bloodGroup: BloodGroup,
    radiusKm = 25,
  ) {
    const compatibleGroups = getCompatibleDonorGroups(bloodGroup);
    const now = new Date();
    const skippedReasons: Record<string, number> = {
      inactiveAccount: 0,
      accountNotVerified: 0,
      incompleteProfile: 0,
      incompatibleBloodType: 0,
      eligibilityNotApproved: 0,
      coolingPeriod: 0,
      unavailable: 0,
      notificationConsentDisabled: 0,
      noValidLocation: 0,
      outsideRadius: 0,
    };

    const candidates = await this.prisma.donor.findMany({
      where: {
        bloodGroup: { in: compatibleGroups.length > 0 ? compatibleGroups : [BloodGroup.UNKNOWN] },
        NOT: { bloodGroup: BloodGroup.UNKNOWN },
      },
      select: {
        id: true,
        donorNumber: true,
        fullName: true,
        userId: true,
        bloodGroup: true,
        latitude: true,
        longitude: true,
        locationSharingEnabled: true,
        eligibilityStatus: true,
        availabilityStatus: true,
        nextEligibilityDate: true,
        notificationEmailEnabled: true,
        notificationSmsEnabled: true,
        phone: true,
        alternativePhoneNumber: true,
        clinicalRecords: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { status: true },
        },
        user: { select: { isActive: true, emailVerified: true } },
      },
      take: 500,
    });

    const selected: Array<{
      id: string;
      donorNumber: string | null;
      fullName: string;
      userId: string;
      bloodGroup: BloodGroup;
      distanceKm: number | null;
      phone: string | null;
      alternativePhoneNumber: string | null;
      notificationSmsEnabled: boolean;
    }> = [];

    for (const donor of candidates) {
      if (!compatibleGroups.includes(donor.bloodGroup)) {
        skippedReasons.incompatibleBloodType += 1;
        continue;
      }
      if (!donor.user.isActive) {
        skippedReasons.inactiveAccount += 1;
        continue;
      }
      if (!donor.user.emailVerified) {
        skippedReasons.accountNotVerified += 1;
        continue;
      }
      if (!donor.fullName || !donor.donorNumber) {
        skippedReasons.incompleteProfile += 1;
        continue;
      }
      if (!donor.eligibilityStatus) {
        skippedReasons.eligibilityNotApproved += 1;
        continue;
      }
      if (donor.clinicalRecords[0]?.status !== DonorClinicalStatus.APPROVED) {
        skippedReasons.eligibilityNotApproved += 1;
        continue;
      }
      if (donor.nextEligibilityDate && donor.nextEligibilityDate > now) {
        skippedReasons.coolingPeriod += 1;
        continue;
      }
      if (!donor.availabilityStatus) {
        skippedReasons.unavailable += 1;
        continue;
      }
      if (!donor.notificationEmailEnabled && !donor.notificationSmsEnabled) {
        skippedReasons.notificationConsentDisabled += 1;
        continue;
      }

      let distanceKm: number | null = null;
      if (typeof hospital.latitude === 'number' && typeof hospital.longitude === 'number') {
        if (!donor.locationSharingEnabled || typeof donor.latitude !== 'number' || typeof donor.longitude !== 'number') {
          skippedReasons.noValidLocation += 1;
          continue;
        }
        distanceKm = this.distanceKm(hospital.latitude, hospital.longitude, donor.latitude, donor.longitude);
        if (distanceKm > radiusKm) {
          skippedReasons.outsideRadius += 1;
          continue;
        }
      }

      selected.push({
        id: donor.id,
        donorNumber: donor.donorNumber,
        fullName: donor.fullName,
        userId: donor.userId,
        bloodGroup: donor.bloodGroup,
        distanceKm,
        phone: donor.phone,
        alternativePhoneNumber: donor.alternativePhoneNumber,
        notificationSmsEnabled: donor.notificationSmsEnabled,
      });
    }

    return {
      donors: selected
        .sort((a, b) => (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY))
        .slice(0, 100),
      skippedReasons,
      compatibleGroups,
    };
  }

  private getRecommendation(args: {
    level: StockWarningLevel;
    bloodGroup: BloodGroup;
    usableUnits: number;
    incomingTransferUnits: number;
    scheduledDonationUnits: number;
    eligibleDonorCount: number;
  }) {
    if (args.level === StockWarningLevel.STABLE) {
      return {
        action: 'No Immediate Action Required',
        reason: `${this.formatBloodGroup(args.bloodGroup)} stock is stable against current operating thresholds.`,
      };
    }

    if (args.eligibleDonorCount > 0 && args.incomingTransferUnits === 0) {
      return {
        action: 'Launch Proactive Donor Campaign',
        reason: `${this.formatBloodGroup(args.bloodGroup)} stock needs attention. We recommend launching a proactive donor campaign because there are ${args.eligibleDonorCount} mobilizable donor${args.eligibleDonorCount === 1 ? '' : 's'} within the configured radius and no confirmed incoming blood transfers.`,
      };
    }

    if (args.incomingTransferUnits > 0 && args.usableUnits > 0) {
      return {
        action: 'Monitor Inventory',
        reason: `${this.formatBloodGroup(args.bloodGroup)} has ${args.incomingTransferUnits} incoming transfer unit${args.incomingTransferUnits === 1 ? '' : 's'} expected. Monitor receipt and expiry before launching a new campaign.`,
      };
    }

    if (args.scheduledDonationUnits > 0) {
      return {
        action: 'Increase Donation Appointments',
        reason: `${this.formatBloodGroup(args.bloodGroup)} has scheduled donation appointments, but current usable stock remains low. Confirm attendance and add more appointments if needed.`,
      };
    }

    return {
      action: 'Request Blood Transfer',
      reason: `${this.formatBloodGroup(args.bloodGroup)} stock is at risk and no eligible nearby donors or incoming transfers are currently available.`,
    };
  }

  private async evaluateInventoryRisk(hospitalId: string, bloodGroup: string, availableUnits: number, actorUserId: string) {
    const criticalThreshold = this.getCriticalThreshold(bloodGroup);
    if (availableUnits <= criticalThreshold) {
      this.alerts.notifyCritical('INVENTORY_CRITICAL_THRESHOLD', {
        hospitalId,
        bloodGroup,
        availableUnits,
        criticalThreshold,
      });
      await this.audit.log('INVENTORY_CRITICAL_THRESHOLD', 'INVENTORY', actorUserId, hospitalId, {
        bloodGroup,
        availableUnits,
        criticalThreshold,
      });
    }
  }

  async upsert(userId: string, dto: UpsertInventoryDto) {
    const hospital = await this.getHospitalForUser(userId);

    if (dto.bloodGroup === BloodGroup.UNKNOWN) {
      throw new BadRequestException('Inventory requires a confirmed blood group.');
    }

    const item = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.inventoryItem.findUnique({
        where: {
          hospitalId_bloodGroup: { hospitalId: hospital.id, bloodGroup: dto.bloodGroup },
        },
      });

      const updated = await tx.inventoryItem.upsert({
        where: {
          hospitalId_bloodGroup: { hospitalId: hospital.id, bloodGroup: dto.bloodGroup },
        },
        update: { availableUnits: dto.availableUnits, updatedById: userId },
        create: {
          hospitalId: hospital.id,
          bloodGroup: dto.bloodGroup,
          availableUnits: dto.availableUnits,
          updatedById: userId,
        },
      });

      await tx.inventoryLog.create({
        data: {
          inventoryId: updated.id,
          changeType: existing ? InventoryChangeType.ADJUSTED : InventoryChangeType.ADDED,
          unitsChanged: existing ? dto.availableUnits - existing.availableUnits : dto.availableUnits,
          previousUnits: existing?.availableUnits ?? 0,
          newUnits: dto.availableUnits,
          reason: dto.reason?.trim() || (existing ? 'Manual stock level correction' : 'Initial inventory stock'),
          changedById: userId,
        },
      });

      return updated;
    });

    await this.audit.log('INVENTORY_UPDATED', 'INVENTORY', userId, item.id, dto);
    await this.evaluateInventoryRisk(item.hospitalId, item.bloodGroup, item.availableUnits, userId);
    this.realtime.broadcastInventoryUpdate({
      inventoryId: item.id,
      hospitalId: item.hospitalId,
      bloodGroup: item.bloodGroup,
      availableUnits: item.availableUnits,
      updatedBy: userId,
    });
    return item;
  }

  async list(userId: string, role: Role, query: PaginationQueryDto) {
    const skip = query.skip ?? 0;
    const take = query.take ?? 100;
    if (role === Role.ADMIN) {
      return this.prisma.inventoryItem.findMany({
        include: {
          hospital: { select: { hospitalName: true, location: true } },
          updatedBy: { select: { email: true } },
        },
        orderBy: { lastUpdated: 'desc' },
        skip,
        take,
      });
    }

    const hospital = await this.getHospitalForUser(userId);
    return this.prisma.inventoryItem.findMany({
      where: { hospitalId: hospital.id },
      include: {
        hospital: { select: { hospitalName: true, location: true } },
        updatedBy: { select: { email: true } },
      },
      orderBy: { lastUpdated: 'desc' },
      skip,
      take,
    });
  }

  async updateItem(id: string, userId: string, role: Role, dto: UpdateInventoryItemDto) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id },
      include: { hospital: { select: { userId: true } } },
    });

    if (!item) {
      throw new NotFoundException('Inventory item not found');
    }

    await this.hospitalAccess.assertHospitalAccess(item.hospitalId, userId, role);

    const previousUnits = item.availableUnits;
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.inventoryItem.update({
        where: { id },
        data: { availableUnits: dto.availableUnits, updatedById: userId },
      });

      await tx.inventoryLog.create({
        data: {
          inventoryId: id,
          changeType: InventoryChangeType.ADJUSTED,
          unitsChanged: dto.availableUnits - previousUnits,
          previousUnits,
          newUnits: dto.availableUnits,
          reason: dto.reason ?? 'Manual inventory update',
          changedById: userId,
        },
      });

      return next;
    });

    await this.audit.log('INVENTORY_ITEM_UPDATED', 'INVENTORY', userId, id, {
      previousUnits,
      newUnits: dto.availableUnits,
      reason: dto.reason,
    });
    await this.evaluateInventoryRisk(item.hospitalId, item.bloodGroup, updated.availableUnits, userId);
    this.realtime.broadcastInventoryUpdate({
      inventoryId: id,
      availableUnits: updated.availableUnits,
      updatedBy: userId,
    });
    return updated;
  }

  async listLogs(userId: string, role: Role, query: PaginationQueryDto) {
    const skip = query.skip ?? 0;
    const take = query.take ?? 100;
    if (role === Role.ADMIN) {
      return this.prisma.inventoryLog.findMany({
        include: {
          inventory: {
            include: {
              hospital: { select: { hospitalName: true, location: true } },
            },
          },
          changedBy: { select: { email: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      });
    }

    const hospital = await this.getHospitalForUser(userId);
    return this.prisma.inventoryLog.findMany({
      where: {
        inventory: { hospitalId: hospital.id },
      },
      include: {
        inventory: {
          include: {
            hospital: { select: { hospitalName: true, location: true } },
          },
        },
        changedBy: { select: { email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  async createLog(id: string, userId: string, role: Role, dto: CreateInventoryLogDto) {
    const inventory = await this.prisma.inventoryItem.findUnique({
      where: { id },
      include: { hospital: { select: { userId: true } } },
    });
    if (!inventory) {
      throw new NotFoundException('Inventory item not found');
    }

    await this.hospitalAccess.assertHospitalAccess(inventory.hospitalId, userId, role);

    if (dto.unitsChanged < 0) {
      throw new BadRequestException('unitsChanged must be non-negative');
    }

    const previousUnits = inventory.availableUnits;
    const newUnits = this.calculateUnits(previousUnits, dto.unitsChanged, dto.changeType);
    if (newUnits < 0) {
      throw new BadRequestException('Inventory cannot be negative');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedInventory = await tx.inventoryItem.update({
        where: { id },
        data: { availableUnits: newUnits, updatedById: userId },
      });

      const log = await tx.inventoryLog.create({
        data: {
          inventoryId: id,
          changeType: dto.changeType,
          unitsChanged: dto.unitsChanged,
          previousUnits,
          newUnits,
          reason: dto.reason,
          changedById: userId,
        },
      });

      return { updatedInventory, log };
    });

    await this.audit.log('INVENTORY_LOG_CREATED', 'INVENTORY_LOG', userId, result.log.id, {
      inventoryId: id,
      changeType: dto.changeType,
      unitsChanged: dto.unitsChanged,
      previousUnits,
      newUnits,
    });
    await this.evaluateInventoryRisk(inventory.hospitalId, inventory.bloodGroup, result.updatedInventory.availableUnits, userId);

    this.realtime.broadcastInventoryUpdate({
      inventoryId: id,
      availableUnits: result.updatedInventory.availableUnits,
      changeType: dto.changeType,
      unitsChanged: dto.unitsChanged,
      updatedBy: userId,
    });

    return result;
  }

  async getEarlyWarnings(userId: string, role: Role) {
    const hospital =
      role === Role.ADMIN
        ? null
        : await this.getHospitalForUser(userId);

    const where = hospital ? { hospitalId: hospital.id } : {};
    const forecastPeriodHours = 48;
    const usageSince = new Date(Date.now() - USAGE_HISTORY_WINDOW_DAYS * 86_400_000);
    const now = new Date();
    const forecastWindowEnd = new Date(now.getTime() + forecastPeriodHours * 60 * 60_000);
    const [inventory, activeRequests, usageLogs, incomingTransfers, scheduledAppointments] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where,
        include: { hospital: { select: { id: true, hospitalName: true, city: true, region: true, latitude: true, longitude: true } } },
      }),
      this.prisma.bloodRequest.findMany({
        where: {
          ...(hospital ? { hospitalId: hospital.id } : {}),
          status: { in: [RequestStatus.OPEN, RequestStatus.MATCHING] },
        },
        select: { bloodGroup: true, unitsNeeded: true, priority: true },
      }),
      this.prisma.inventoryLog.findMany({
        where: {
          inventory: where,
          createdAt: { gte: usageSince },
        },
        select: {
          changeType: true,
          unitsChanged: true,
          createdAt: true,
          inventory: { select: { bloodGroup: true } },
        },
      }),
      this.prisma.hospitalBloodTransfer.findMany({
        where: {
          ...(hospital ? { receivingHospitalId: hospital.id } : {}),
          status: { in: [HospitalBloodTransferStatus.ACCEPTED, HospitalBloodTransferStatus.DISPATCHED] },
        },
        select: { bloodGroup: true, units: true, dispatchedUnits: true, receivedUnits: true, status: true },
      }),
      this.prisma.appointment.findMany({
        where: {
          ...(hospital ? { hospitalId: hospital.id } : {}),
          status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
          scheduledAt: { gte: now, lte: forecastWindowEnd },
          donor: {
            bloodGroup: { not: BloodGroup.UNKNOWN },
            eligibilityStatus: true,
            availabilityStatus: true,
            user: { isActive: true, emailVerified: true },
            clinicalRecords: { some: { status: DonorClinicalStatus.APPROVED } },
            OR: [{ nextEligibilityDate: null }, { nextEligibilityDate: { lte: now } }],
          },
        },
        select: { donor: { select: { bloodGroup: true } }, unitsCollected: true },
      }),
    ]);

    const demandByGroup = activeRequests.reduce<Record<string, number>>((acc, request) => {
      acc[request.bloodGroup] = (acc[request.bloodGroup] ?? 0) + request.unitsNeeded;
      return acc;
    }, {});
    const urgentDemandByGroup = activeRequests.reduce<Record<string, number>>((acc, request) => {
      if (request.priority === PriorityLevel.CRITICAL || request.priority === PriorityLevel.HIGH) {
        acc[request.bloodGroup] = (acc[request.bloodGroup] ?? 0) + request.unitsNeeded;
      }
      return acc;
    }, {});
    const usageByGroup = usageLogs
      .filter((log) => log.changeType === InventoryChangeType.USED)
      .reduce<Record<string, number>>((acc, log) => {
        acc[log.inventory.bloodGroup] = (acc[log.inventory.bloodGroup] ?? 0) + Math.abs(log.unitsChanged);
        return acc;
      }, {});
    const usageHistoryCountByGroup = usageLogs
      .filter((log) => log.changeType === InventoryChangeType.USED)
      .reduce<Record<string, number>>((acc, log) => {
        acc[log.inventory.bloodGroup] = (acc[log.inventory.bloodGroup] ?? 0) + 1;
        return acc;
      }, {});
    const recentIncomingByGroup = usageLogs
      .filter((log) => log.changeType === InventoryChangeType.ADDED)
      .reduce<Record<string, number>>((acc, log) => {
        acc[log.inventory.bloodGroup] = (acc[log.inventory.bloodGroup] ?? 0) + Math.abs(log.unitsChanged);
        return acc;
      }, {});
    const recentOutgoingByGroup = usageLogs
      .filter((log) => log.changeType === InventoryChangeType.USED || log.changeType === InventoryChangeType.EXPIRED)
      .reduce<Record<string, number>>((acc, log) => {
        acc[log.inventory.bloodGroup] = (acc[log.inventory.bloodGroup] ?? 0) + Math.abs(log.unitsChanged);
        return acc;
      }, {});
    const incomingByGroup = incomingTransfers.reduce<Record<string, number>>((acc, transfer) => {
      const committedUnits =
        transfer.status === HospitalBloodTransferStatus.DISPATCHED
          ? Number(transfer.dispatchedUnits ?? transfer.units)
          : Number(transfer.units);
      acc[transfer.bloodGroup] = (acc[transfer.bloodGroup] ?? 0) + Math.max(0, committedUnits - Number(transfer.receivedUnits ?? 0));
      return acc;
    }, {});
    const scheduledByGroup = scheduledAppointments.reduce<Record<string, number>>((acc, appointment) => {
      const group = appointment.donor.bloodGroup;
      acc[group] = (acc[group] ?? 0) + Number(appointment.unitsCollected ?? 1);
      return acc;
    }, {});

    const inventoryByGroup = new Map(inventory.filter((item) => item.bloodGroup !== BloodGroup.UNKNOWN).map((item) => [item.bloodGroup, item]));
    const fallbackHospital = hospital ?? inventory[0]?.hospital ?? null;

    const warnings = await Promise.all(CORE_BLOOD_GROUPS.map(async (bloodGroup) => {
      const item = inventoryByGroup.get(bloodGroup);
      const hospitalContext = hospital ?? item?.hospital ?? fallbackHospital;
      const currentUnits = Math.max(0, Number(item?.availableUnits ?? 0));
      const criticalStockLevel = Math.max(0, Number(item?.criticalThreshold ?? this.getCriticalThreshold(bloodGroup)));
      const minimumStockLevel = Math.max(criticalStockLevel, Number(item?.lowThreshold ?? this.getDefaultMinimumThreshold(bloodGroup)));
      const activeDemandUnits = demandByGroup[bloodGroup] ?? 0;
      const urgentRequestedUnits = urgentDemandByGroup[bloodGroup] ?? 0;
      const inventoryExpiringUnits = Math.max(0, Number(item?.expiringUnits ?? 0));
      const expiringUnits = inventoryExpiringUnits;
      const incomingTransferUnits = incomingByGroup[bloodGroup] ?? 0;
      const scheduledDonationUnits = scheduledByGroup[bloodGroup] ?? 0;
      const usageHistoryCount = usageHistoryCountByGroup[bloodGroup] ?? 0;
      const totalUsage = usageByGroup[bloodGroup] ?? 0;
      const averageDailyUsage = usageHistoryCount > 0 ? Number((totalUsage / USAGE_HISTORY_WINDOW_DAYS).toFixed(2)) : null;
      const mobilizableDonors = hospitalContext
        ? (await this.selectMobilizationDonors(hospitalContext, bloodGroup, 25)).donors
        : [];
      const exactAvailableDonors = mobilizableDonors.filter((donor) => donor.bloodGroup === bloodGroup).length;
      const compatibleAvailableDonors = mobilizableDonors.length;
      const health = this.calculateInventoryHealth({
        bloodGroup,
        currentUnits,
        minimumStockLevel,
        criticalStockLevel,
        averageDailyUsage,
        usageHistoryCount,
        unitsExpiringSoon: expiringUnits,
        activeRequestedUnits: activeDemandUnits,
        urgentRequestedUnits,
        incomingTransferUnits,
        scheduledDonationUnits,
        exactAvailableDonors,
        compatibleAvailableDonors,
        recentIncomingUnits: recentIncomingByGroup[bloodGroup] ?? incomingTransferUnits,
        recentOutgoingUnits: recentOutgoingByGroup[bloodGroup] ?? 0,
        lastUpdatedAt: item?.lastUpdated ?? null,
      });
      const level = health.level;
      const eligibleDonorCount = compatibleAvailableDonors;
      const recommendation = this.getRecommendation({
        level,
        bloodGroup,
        usableUnits: health.usableUnits,
        incomingTransferUnits,
        scheduledDonationUnits,
        eligibleDonorCount,
      });

      return {
        hospitalId: item?.hospitalId ?? hospitalContext?.id ?? 'unscoped',
        hospital: hospitalContext,
        bloodGroup,
        level,
        status: health.status,
        currentUnits,
        usableUnits: health.usableUnits,
        minimumStockLevel,
        criticalStockLevel,
        forecastPeriodHours,
        activeDemandUnits,
        activeRequestedUnits: activeDemandUnits,
        urgentRequestedUnits,
        expiringUnits,
        unitsExpiringSoon: expiringUnits,
        expiryWindowDays: EXPIRY_WINDOW_DAYS,
        incomingTransferUnits,
        scheduledDonationUnits,
        recentIncomingUnits: recentIncomingByGroup[bloodGroup] ?? incomingTransferUnits,
        recentOutgoingUnits: recentOutgoingByGroup[bloodGroup] ?? 0,
        eligibleDonorCount,
        exactAvailableDonors,
        compatibleAvailableDonors,
        averageDailyUsage,
        usageHistoryCount,
        riskScore: health.riskScore,
        riskLevel: health.riskLevel,
        dataFreshness: health.dataFreshness,
        lastUpdatedAt: item?.lastUpdated ?? null,
        recommendedActionType: recommendation.action,
        explanation: health.explanation,
        recommendedAction: recommendation.reason,
        riskFactors: health.riskFactors,
        forecastedAvailableUnits: health.forecastedAvailableUnits,
        forecastStatus: health.forecastStatus,
      };
    }));

    await this.recordMeaningfulWarningTransitions(warnings);

    return warnings;
  }

  async mobilizeDonors(
    userId: string,
    role: Role,
    dto: { bloodGroup: BloodGroup; warningLevel?: StockWarningLevel; message?: string; forecastPeriodHours?: number; radiusKm?: number },
  ) {
    if (dto.bloodGroup === BloodGroup.UNKNOWN) {
      throw new BadRequestException('Donor mobilization requires a confirmed blood group.');
    }

    const hospital = await this.getHospitalForUser(userId);
    await this.hospitalAccess.assertHospitalAccess(hospital.id, userId, role);

    const radiusKm = dto.radiusKm ?? 25;
    const forecastPeriodHours = dto.forecastPeriodHours ?? 48;
    const duplicateSince = new Date(Date.now() - MOBILIZATION_DUPLICATE_WINDOW_MINUTES * 60_000);
    const recentCampaign = await this.prisma.donorMobilizationCampaign.findFirst({
      where: {
        hospitalId: hospital.id,
        bloodGroup: dto.bloodGroup,
        status: MobilizationCampaignStatus.SENT,
        createdAt: { gte: duplicateSince },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, targetDonorCount: true, sentAt: true, createdAt: true },
    });
    const createdAt = new Date();

    if (recentCampaign) {
      return {
        success: false,
        bloodGroup: dto.bloodGroup,
        exactMatchCount: 0,
        compatibleMatchCount: 0,
        targetDonorCount: recentCampaign.targetDonorCount,
        targetedDonorCount: recentCampaign.targetDonorCount,
        notificationsCreated: 0,
        notificationsSkipped: 0,
        skippedReasons: {},
        auditLogCreated: false,
        hospitalActivityCreated: false,
        campaignReference: recentCampaign.id,
        duplicateCampaign: true,
        duplicateWindowMinutes: MOBILIZATION_DUPLICATE_WINDOW_MINUTES,
        createdAt: (recentCampaign.sentAt ?? recentCampaign.createdAt).toISOString(),
        message: `A mobilization campaign for ${this.formatBloodGroup(dto.bloodGroup)} was launched recently. No duplicate notifications or SMS were sent.`,
      };
    }

    const { donors, skippedReasons, compatibleGroups } = await this.selectMobilizationDonors(hospital, dto.bloodGroup, radiusKm);
    const exactMatchCount = donors.filter((donor) => donor.bloodGroup === dto.bloodGroup).length;
    const compatibleMatchCount = donors.length - exactMatchCount;

    const message =
      dto.message?.trim() ||
      `Emergency blood donation appeal: ${hospital.hospitalName} currently requires ${this.formatBloodGroup(dto.bloodGroup)} donors. Eligible and available donors are encouraged to respond.`;

    if (donors.length === 0) {
      return {
        success: false,
        bloodGroup: dto.bloodGroup,
        exactMatchCount: 0,
        compatibleMatchCount: 0,
        targetedDonorCount: 0,
        notificationsCreated: 0,
        notificationsSkipped: Object.values(skippedReasons).reduce((sum, count) => sum + count, 0),
        skippedReasons,
        auditLogCreated: false,
        hospitalActivityCreated: false,
        campaignReference: null,
        createdAt: createdAt.toISOString(),
        message: 'No currently eligible and available donors were found for mobilization.',
      };
    }

    const transactionResult = await this.prisma.$transaction(async (tx) => {
      const created = await tx.donorMobilizationCampaign.create({
        data: {
          hospitalId: hospital.id,
          bloodGroup: dto.bloodGroup,
          warningLevel: dto.warningLevel ?? StockWarningLevel.WATCH,
          status: MobilizationCampaignStatus.SENT,
          forecastPeriodHours,
          radiusKm,
          warningReason: `Forecast window ${forecastPeriodHours} hours; donor search radius ${radiusKm} km.`,
          message,
          targetDonorCount: donors.length,
          sentAt: createdAt,
          createdById: userId,
        },
      });

      const donorNotificationResult = await tx.notification.createMany({
        data: donors.map((donor) => ({
          userId: donor.userId,
          title: 'Emergency Donation Appeal',
          body: message,
          channel: 'IN_APP',
          type: NotificationType.PROACTIVE_DONATION,
          campaignId: created.id,
          delivered: false,
        })),
      });

      await tx.notification.create({
        data: {
          userId: hospital.userId,
          title: `Donor mobilisation campaign launched for ${this.formatBloodGroup(dto.bloodGroup)}`,
          body: `${donors.length} eligible compatible donor${donors.length === 1 ? '' : 's'} notified for ${this.formatBloodGroup(dto.bloodGroup)} at ${hospital.hospitalName}.`,
          channel: 'IN_APP',
          type: NotificationType.SYSTEM,
          campaignId: created.id,
          delivered: false,
        },
      });

      await tx.activityLog.create({
        data: {
          actorUserId: userId,
          actorName: hospital.hospitalName,
          type: 'DONOR_MOBILIZATION_SENT',
          module: 'INVENTORY',
          title: `Donor mobilisation campaign launched for ${this.formatBloodGroup(dto.bloodGroup)}`,
          description: `${hospital.hospitalName} notified ${donors.length} eligible compatible donor${donors.length === 1 ? '' : 's'} for ${this.formatBloodGroup(dto.bloodGroup)}.`,
          entityType: 'DONOR_MOBILIZATION_CAMPAIGN',
          entityId: created.id,
          hospitalId: hospital.id,
          metadata: {
            bloodGroup: dto.bloodGroup,
            compatibleGroups,
            targetedDonorCount: donors.length,
            notificationsCreated: donorNotificationResult.count,
            skippedReasons,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'DONOR_MOBILIZATION_SENT',
          entityType: 'INVENTORY',
          actorUserId: userId,
          entityId: created.id,
          module: 'INVENTORY',
          description: `Hospital Admin at ${hospital.hospitalName} launched a ${this.formatBloodGroup(dto.bloodGroup)} donor mobilisation campaign. ${donorNotificationResult.count} eligible compatible donor${donorNotificationResult.count === 1 ? '' : 's'} were notified.`,
          metadata: {
            hospitalId: hospital.id,
            hospitalName: hospital.hospitalName,
            bloodGroup: dto.bloodGroup,
            compatibleGroups,
            exactMatchCount,
            compatibleMatchCount,
            targetDonorCount: donors.length,
            notificationsCreated: donorNotificationResult.count,
            campaignMessage: message,
            campaignReference: created.id,
            createdAt: createdAt.toISOString(),
            forecastPeriodHours,
            radiusKm,
            skippedReasons,
          },
        },
      });

      return { campaign: created, notificationsCreated: donorNotificationResult.count };
    });

    donors.forEach((donor) => {
      this.realtime.broadcastNotification({
        userId: donor.userId,
        title: 'Emergency Donation Appeal',
        campaignId: transactionResult.campaign.id,
        type: NotificationType.PROACTIVE_DONATION,
        bloodGroup: dto.bloodGroup,
        source: 'EARLY_WARNING_CAMPAIGN',
        createdAt: createdAt.toISOString(),
      });
    });
    this.realtime.broadcastNotification({
      userId: hospital.userId,
      title: `Donor mobilisation campaign launched for ${this.formatBloodGroup(dto.bloodGroup)}`,
      campaignId: transactionResult.campaign.id,
      type: NotificationType.SYSTEM,
      bloodGroup: dto.bloodGroup,
      source: 'EARLY_WARNING_CAMPAIGN',
      createdAt: createdAt.toISOString(),
    });

    const smsRecipients = donors
      .filter((donor) => donor.notificationSmsEnabled)
      .map((donor) => donor.phone ?? donor.alternativePhoneNumber);
    const smsMessage = `BloodSOS: ${hospital.hospitalName} urgently needs ${this.formatBloodGroup(dto.bloodGroup)} blood. Eligible donors, please open the platform to respond. Ref: ${transactionResult.campaign.id}`;
    const smsResult = await this.smsService.sendBulkSms({
      recipients: smsRecipients,
      message: smsMessage,
      purpose: SmsPurpose.DONOR_MOBILIZATION,
      hospitalId: hospital.id,
      triggeredByUserId: userId,
      relatedEntityType: 'DONOR_MOBILIZATION_CAMPAIGN',
      relatedEntityId: transactionResult.campaign.id,
      idempotencyKey: this.smsService.buildEventIdempotencyKey(
        SmsPurpose.DONOR_MOBILIZATION,
        'DONOR_MOBILIZATION_CAMPAIGN',
        transactionResult.campaign.id,
        'SENT',
        smsRecipients.filter((recipient): recipient is string => Boolean(recipient)),
      ),
    });

    await this.prisma.activityLog.create({
      data: {
        actorUserId: userId,
        actorName: hospital.hospitalName,
        type: smsResult.success ? 'DONOR_MOBILIZATION_SMS_SENT' : 'DONOR_MOBILIZATION_SMS_FAILED',
        module: 'SMS',
        title: smsResult.success ? 'Donor mobilization SMS accepted by provider' : 'Donor mobilization SMS not sent',
        description: smsResult.success
          ? `${smsResult.sentCount} donor SMS message${smsResult.sentCount === 1 ? '' : 's'} accepted for ${this.formatBloodGroup(dto.bloodGroup)} mobilization.`
          : smsResult.errorMessage ?? 'SMS provider did not accept the donor mobilization message.',
        entityType: 'DONOR_MOBILIZATION_CAMPAIGN',
        entityId: transactionResult.campaign.id,
        hospitalId: hospital.id,
        metadata: {
          smsStatus: smsResult.status,
          smsLogId: smsResult.smsLogId,
          smsEligibleRecipients: smsResult.validRecipients,
          smsSent: smsResult.sentCount,
          smsRejected: smsResult.rejectedCount,
          skippedInvalidRecipients: smsResult.skippedInvalidRecipients,
          providerCampaignId: smsResult.providerCampaignId ?? null,
          errorCode: smsResult.errorCode ?? null,
        },
      },
    });

    await this.audit.log(
      smsResult.success ? 'DONOR_MOBILIZATION_SMS_SENT' : 'DONOR_MOBILIZATION_SMS_FAILED',
      'SMS',
      userId,
      smsResult.smsLogId ?? transactionResult.campaign.id,
      {
        campaignReference: transactionResult.campaign.id,
        bloodGroup: dto.bloodGroup,
        smsStatus: smsResult.status,
        smsEligibleRecipients: smsResult.validRecipients,
        smsSent: smsResult.sentCount,
        smsRejected: smsResult.rejectedCount,
        skippedInvalidRecipients: smsResult.skippedInvalidRecipients,
        providerCampaignId: smsResult.providerCampaignId ?? null,
        errorCode: smsResult.errorCode ?? null,
      },
      smsResult.success ? 'Donor mobilization SMS accepted by provider.' : 'Donor mobilization SMS failed or was skipped.',
      { module: 'SMS' },
    );

    return {
      success: true,
      bloodGroup: dto.bloodGroup,
      exactMatchCount,
      compatibleMatchCount,
      targetDonorCount: donors.length,
      targetedDonorCount: donors.length,
      notificationsCreated: transactionResult.notificationsCreated,
      notificationsSkipped: Object.values(skippedReasons).reduce((sum, count) => sum + count, 0),
      skippedReasons,
      auditLogCreated: true,
      hospitalActivityCreated: true,
      campaignReference: transactionResult.campaign.id,
      inAppNotificationsCreated: transactionResult.notificationsCreated,
      smsEligibleRecipients: smsResult.validRecipients,
      smsSent: smsResult.sentCount,
      smsRejected: smsResult.rejectedCount,
      smsStatus: smsResult.status,
      providerCampaignId: smsResult.providerCampaignId ?? null,
      createdAt: createdAt.toISOString(),
      message: smsResult.success
        ? `Mobilization alert sent to ${donors.length} compatible available donor${donors.length === 1 ? '' : 's'} with ${smsResult.sentCount} SMS accepted.`
        : `Mobilization alert sent in-app to ${donors.length} compatible available donor${donors.length === 1 ? '' : 's'}; SMS status: ${smsResult.status}.`,
    };
  }

  async previewMobilization(
    userId: string,
    role: Role,
    dto: { bloodGroup: BloodGroup; warningLevel?: StockWarningLevel; forecastPeriodHours?: number; radiusKm?: number },
  ) {
    if (dto.bloodGroup === BloodGroup.UNKNOWN) {
      throw new BadRequestException('Donor mobilization requires a confirmed blood group.');
    }

    const hospital = await this.getHospitalForUser(userId);
    await this.hospitalAccess.assertHospitalAccess(hospital.id, userId, role);

    const radiusKm = dto.radiusKm ?? 25;
    const forecastPeriodHours = dto.forecastPeriodHours ?? 48;
    const { donors } = await this.selectMobilizationDonors(hospital, dto.bloodGroup, radiusKm);
    const donorBloodGroups = donors.reduce<Record<string, number>>((acc, donor) => {
      acc[donor.bloodGroup] = (acc[donor.bloodGroup] ?? 0) + 1;
      return acc;
    }, {});

    await this.audit.log('DONOR_MOBILIZATION_PREVIEWED', 'INVENTORY', userId, hospital.id, {
      hospitalId: hospital.id,
      bloodGroup: dto.bloodGroup,
      eligibleDonorCount: donors.length,
      forecastPeriodHours,
      radiusKm,
    });

    return {
      hospitalId: hospital.id,
      hospitalName: hospital.hospitalName,
      bloodGroup: dto.bloodGroup,
      warningLevel: dto.warningLevel ?? StockWarningLevel.WATCH,
      forecastPeriodHours,
      radiusKm,
      eligibleDonorCount: donors.length,
      donorBloodGroups,
      previewNote:
        donors.length > 0
          ? `${donors.length} approved available donor${donors.length === 1 ? '' : 's'} can receive a non-emergency donation invitation.`
          : 'No currently eligible and available donors were found for mobilization.',
    };
  }

  async listMobilizationCampaigns(userId: string, role: Role) {
    const hospital = role === Role.ADMIN ? null : await this.getHospitalForUser(userId);
    const campaigns = await this.prisma.donorMobilizationCampaign.findMany({
      where: hospital ? { hospitalId: hospital.id } : {},
      include: {
        hospital: { select: { id: true, hospitalName: true, city: true, region: true } },
        responses: {
          include: {
            donor: {
              select: {
                id: true,
                donorNumber: true,
                fullName: true,
                bloodGroup: true,
                location: true,
                lastDonationDate: true,
                nextEligibilityDate: true,
              },
            },
          },
          orderBy: { respondedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const campaignIds = campaigns.map((campaign) => campaign.id);
    const donorIds = [...new Set(campaigns.flatMap((campaign) => campaign.responses.map((response) => response.donorId)))];

    const [appointments, donations, notifications] = await Promise.all([
      donorIds.length
        ? this.prisma.appointment.findMany({
            where: {
              donorId: { in: donorIds },
              ...(hospital ? { hospitalId: hospital.id } : {}),
            },
            select: {
              id: true,
              appointmentReference: true,
              donorId: true,
              hospitalId: true,
              status: true,
              scheduledAt: true,
              donationPostedAt: true,
            },
          })
        : Promise.resolve([]),
      donorIds.length
        ? this.prisma.donation.findMany({
            where: {
              donorId: { in: donorIds },
              ...(hospital ? { hospitalId: hospital.id } : {}),
            },
            select: { id: true, donorId: true, hospitalId: true, unitsDonated: true, donatedAt: true, donationNumber: true },
          })
        : Promise.resolve([]),
      campaignIds.length
        ? this.prisma.notification.groupBy({
            by: ['campaignId'],
            where: { campaignId: { in: campaignIds }, type: NotificationType.PROACTIVE_DONATION },
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ]);

    return campaigns.map((campaign) => {
      const notificationCount = notifications.find((item) => item.campaignId === campaign.id)?._count._all ?? 0;
      const interested = campaign.responses.filter(
        (response) =>
          response.responseStatus === MobilizationResponseStatus.INTERESTED ||
          response.responseStatus === MobilizationResponseStatus.APPOINTMENT_SCHEDULED,
      );
      const declined = campaign.responses.filter((response) => response.responseStatus === MobilizationResponseStatus.NOT_AVAILABLE);
      const campaignAppointments = appointments.filter(
        (appointment) =>
          appointment.hospitalId === campaign.hospitalId &&
          campaign.responses.some((response) => response.donorId === appointment.donorId) &&
          appointment.scheduledAt >= campaign.createdAt,
      );
      const completedDonations = donations.filter(
        (donation) =>
          donation.hospitalId === campaign.hospitalId &&
          campaign.responses.some((response) => response.donorId === donation.donorId) &&
          donation.donatedAt >= campaign.createdAt,
      );
      const confirmedAppointments = campaignAppointments.filter((appointment) =>
        appointment.status === AppointmentStatus.CONFIRMED || appointment.status === AppointmentStatus.COMPLETED,
      );
      const responseRate = campaign.targetDonorCount
        ? Number(((campaign.responses.length / campaign.targetDonorCount) * 100).toFixed(1))
        : 0;
      const appointmentConversionRate = interested.length
        ? Number(((campaignAppointments.length / interested.length) * 100).toFixed(1))
        : 0;
      const donationSuccessRate = campaignAppointments.length
        ? Number(((completedDonations.length / campaignAppointments.length) * 100).toFixed(1))
        : 0;

      return {
        id: campaign.id,
        campaignName: `${campaign.bloodGroup} ${campaign.warningLevel.replace('_', ' ')} campaign`,
        hospital: campaign.hospital,
        bloodGroup: campaign.bloodGroup,
        warningLevel: campaign.warningLevel,
        status: campaign.status,
        forecastPeriodHours: campaign.forecastPeriodHours,
        radiusKm: campaign.radiusKm,
        eligibleDonors: campaign.targetDonorCount,
        donorsNotified: notificationCount || campaign.targetDonorCount,
        interestedDonors: interested.length,
        declinedResponses: declined.length,
        appointmentRequests: campaignAppointments.length,
        confirmedAppointments: confirmedAppointments.length,
        completedDonations: completedDonations.length,
        donatedUnits: completedDonations.reduce((sum, donation) => sum + donation.unitsDonated, 0),
        responseRate,
        appointmentConversionRate,
        donationSuccessRate,
        warningReason: campaign.warningReason,
        message: campaign.message,
        sentAt: campaign.sentAt,
        createdAt: campaign.createdAt,
        responses: campaign.responses.map((response) => ({
          id: response.id,
          responseStatus: response.responseStatus,
          respondedAt: response.respondedAt,
          notes: response.notes,
          donor: response.donor,
          appointments: campaignAppointments.filter((appointment) => appointment.donorId === response.donorId),
          donations: completedDonations.filter((donation) => donation.donorId === response.donorId),
        })),
      };
    });
  }

  async getStockTrends(userId: string, role: Role, days = 30) {
    const hospital = role === Role.ADMIN ? null : await this.getHospitalForUser(userId);
    const windowDays = Math.min(Math.max(Number(days) || 30, 7), 90);
    const since = new Date(Date.now() - windowDays * 86_400_000);
    const logs = await this.prisma.inventoryLog.findMany({
      where: {
        createdAt: { gte: since },
        ...(hospital ? { inventory: { hospitalId: hospital.id } } : {}),
      },
      include: {
        inventory: {
          select: {
            bloodGroup: true,
            hospital: { select: { id: true, hospitalName: true, city: true, region: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const byGroup = logs.reduce<
      Record<string, { bloodGroup: string; points: Array<{ date: string; units: number }>; lowEvents: number; criticalEvents: number }>
    >((acc, log) => {
      const key = log.inventory.bloodGroup;
      acc[key] ??= { bloodGroup: key, points: [], lowEvents: 0, criticalEvents: 0 };
      acc[key].points.push({ date: log.createdAt.toISOString(), units: log.newUnits });
      if (log.newUnits <= 3) acc[key].criticalEvents += 1;
      else if (log.newUnits <= 7) acc[key].lowEvents += 1;
      return acc;
    }, {});

    return {
      windowDays,
      generatedAt: new Date().toISOString(),
      trends: Object.values(byGroup),
    };
  }
}
