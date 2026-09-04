import { ForbiddenException } from '@nestjs/common';
import { BloodGroup, PermissionCode, Role } from '@prisma/client';
import { describe, expect, it, jest } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ROLE_PERMISSION_DEFAULTS } from '../../common/rbac/permission-matrix';
import { InventoryService } from './inventory.service';

const service = new InventoryService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any) as any;

const baseArgs = {
  bloodGroup: BloodGroup.O_POS,
  currentUnits: 20,
  minimumStockLevel: 10,
  criticalStockLevel: 3,
  averageDailyUsage: 2,
  usageHistoryCount: 6,
  unitsExpiringSoon: 0,
  activeRequestedUnits: 0,
  urgentRequestedUnits: 0,
  incomingTransferUnits: 0,
  scheduledDonationUnits: 0,
  exactAvailableDonors: 4,
  compatibleAvailableDonors: 10,
  recentIncomingUnits: 8,
  recentOutgoingUnits: 6,
  lastUpdatedAt: new Date(),
};

describe('InventoryService inventory health rules', () => {
  it('marks zero usable units as critical with high risk', () => {
    const result = service.calculateInventoryHealth({
      ...baseArgs,
      currentUnits: 0,
      averageDailyUsage: null,
      usageHistoryCount: 0,
      exactAvailableDonors: 0,
      compatibleAvailableDonors: 0,
    });

    expect(result.status).toBe('Critical');
    expect(result.level).toBe('CRITICAL');
    expect(result.riskScore).toBeGreaterThanOrEqual(75);
    expect(result.riskLevel).toBe('Critical');
    expect(result).not.toHaveProperty('predictionAvailable');
    expect(result).not.toHaveProperty('predictionLabel');
    expect(result).not.toHaveProperty('confidenceLevel');
  });

  it('calculates current risk without requiring usage history', () => {
    const result = service.calculateInventoryHealth({
      ...baseArgs,
      currentUnits: 4,
      averageDailyUsage: null,
      usageHistoryCount: 0,
    });

    expect(result.status).toBe('Low Stock');
    expect(result.riskScore).toBeGreaterThanOrEqual(25);
    expect(result).not.toHaveProperty('confidenceScore');
  });

  it('marks urgent demand greater than usable stock as critical', () => {
    const result = service.calculateInventoryHealth({
      ...baseArgs,
      currentUnits: 12,
      activeRequestedUnits: 6,
      urgentRequestedUnits: 8,
      unitsExpiringSoon: 1,
    });

    expect(result.usableUnits).toBe(5);
    expect(result.status).toBe('Critical');
    expect(result.riskScore).toBeGreaterThanOrEqual(50);
  });

  it('keeps current zero stock critical while incoming supply improves the forecast', () => {
    const result = service.calculateInventoryHealth({
      ...baseArgs,
      currentUnits: 0,
      activeRequestedUnits: 0,
      urgentRequestedUnits: 0,
      incomingTransferUnits: 10,
      scheduledDonationUnits: 1,
    });

    expect(result.usableUnits).toBe(0);
    expect(result.forecastedAvailableUnits).toBe(11);
    expect(result.status).toBe('Critical');
    expect(result.forecastStatus).toBe('Healthy');
    expect(result.explanation).toContain('forecasted available stock is 11');
  });

  it('marks adequate stock with low demand as healthy and low risk', () => {
    const result = service.calculateInventoryHealth(baseArgs);

    expect(result.status).toBe('Healthy');
    expect(result.level).toBe('STABLE');
    expect(result.riskScore).toBeLessThan(25);
    expect(result.riskFactors).toContain('Donor availability risk: 0/15');
  });

  it('increases risk when expiring stock reduces usable units below minimum', () => {
    const result = service.calculateInventoryHealth({
      ...baseArgs,
      currentUnits: 14,
      unitsExpiringSoon: 6,
    });

    expect(result.status).toBe('Low Stock');
    expect(result.riskScore).toBeGreaterThanOrEqual(25);
  });

  it('keeps risk score clamped between 0 and 100', () => {
    const result = service.calculateInventoryHealth({
      ...baseArgs,
      currentUnits: -10,
      activeRequestedUnits: 100,
      urgentRequestedUnits: 100,
      unitsExpiringSoon: 100,
      compatibleAvailableDonors: 0,
    });

    expect(result.riskScore).toBeGreaterThanOrEqual(0);
    expect(result.riskScore).toBeLessThanOrEqual(100);
  });
});

describe('InventoryService donor mobilization workflow', () => {
  it('blocks unauthorized users from launching campaigns', async () => {
    const unauthorized = new InventoryService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {
        getHospitalForUser: async () => {
          throw new ForbiddenException('No hospital context');
        },
        assertHospitalAccess: jest.fn(),
      } as any,
      {} as any,
    ) as any;

    await expect(
      unauthorized.mobilizeDonors('donor-user', Role.DONOR, {
        bloodGroup: BloodGroup.O_POS,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('selects compatible eligible donors and audits mobilization activity', () => {
    const serviceSource = readFileSync(join(__dirname, 'inventory.service.ts'), 'utf8');
    const controllerSource = readFileSync(join(__dirname, 'inventory.controller.ts'), 'utf8');

    expect(serviceSource).toContain('getCompatibleDonorGroups(bloodGroup)');
    expect(serviceSource).toContain('eligibilityStatus: true');
    expect(serviceSource).toContain('availabilityStatus: true');
    expect(serviceSource).toContain('NotificationType.PROACTIVE_DONATION');
    expect(serviceSource).toContain("title: 'Emergency Donation Appeal'");
    expect(serviceSource).toContain('notificationsCreated');
    expect(serviceSource).toContain('skippedReasons');
    expect(serviceSource).toContain('notificationConsentDisabled');
    expect(serviceSource).toContain('outsideRadius');
    expect(serviceSource).toContain('No currently eligible and available donors were found for mobilization.');
    expect(serviceSource).toContain('DONOR_MOBILIZATION_SENT');
    expect(serviceSource).toContain('tx.auditLog.create');
    expect(serviceSource).toContain('tx.activityLog.create');
    expect(serviceSource).toContain('type: NotificationType.PROACTIVE_DONATION');
    expect(serviceSource).toContain('userId: donor.userId');
    expect(serviceSource).toContain('sendBulkSms');
    expect(serviceSource).toContain('SmsPurpose.DONOR_MOBILIZATION');
    expect(serviceSource).toContain('notificationSmsEnabled');
    expect(serviceSource).toContain('smsEligibleRecipients');
    expect(serviceSource).toContain('DONOR_MOBILIZATION_SMS_SENT');
    expect(controllerSource).toContain('PermissionCode.INVENTORY_REPORT_VIEW, PermissionCode.DONOR_MATCH_VIEW');
  });

  it('records stock warning history only when the state changes', async () => {
    const create = jest.fn((args: unknown) => args);
    const findFirst = jest.fn() as any;
    findFirst
      .mockResolvedValueOnce({
        level: 'CRITICAL',
        currentUnits: 0,
        activeDemandUnits: 0,
        expiringUnits: 0,
        incomingTransferUnits: 0,
        scheduledDonationUnits: 0,
      })
      .mockResolvedValueOnce({
        level: 'WATCH',
        currentUnits: 3,
        activeDemandUnits: 0,
        expiringUnits: 0,
        incomingTransferUnits: 0,
        scheduledDonationUnits: 0,
      });
    const prisma = {
      bloodStockWarning: {
        findFirst,
        create,
      },
      $transaction: jest.fn(),
    };
    const warning = {
      hospitalId: 'hospital-1',
      bloodGroup: BloodGroup.O_POS,
      level: 'CRITICAL',
      currentUnits: 0,
      activeDemandUnits: 0,
      expiringUnits: 0,
      incomingTransferUnits: 0,
      scheduledDonationUnits: 0,
      explanation: 'O+: Critical.',
      recommendedAction: 'Request transfer.',
    };
    const transitionService = new InventoryService(prisma as any, {} as any, {} as any, {} as any, {} as any, {} as any) as any;

    await transitionService.recordMeaningfulWarningTransitions([warning]);
    expect(create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();

    await transitionService.recordMeaningfulWarningTransitions([warning]);
    expect(create).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('keeps early-warning forecasts, donor counts, and launch safety deterministic', () => {
    const serviceSource = readFileSync(join(__dirname, 'inventory.service.ts'), 'utf8');

    expect(serviceSource).toContain('recordMeaningfulWarningTransitions(warnings)');
    expect(serviceSource).toContain('scheduledAt: { gte: now, lte: forecastWindowEnd }');
    expect(serviceSource).toContain('const expiringUnits = inventoryExpiringUnits;');
    expect(serviceSource).toContain('status: { in: [HospitalBloodTransferStatus.ACCEPTED, HospitalBloodTransferStatus.DISPATCHED] }');
    expect(serviceSource).toContain('transfer.status === HospitalBloodTransferStatus.DISPATCHED');
    expect(serviceSource).toContain('selectMobilizationDonors(hospitalContext, bloodGroup, 25)');
    expect(serviceSource).toContain('const eligibleDonorCount = compatibleAvailableDonors;');
    expect(serviceSource).toContain('MOBILIZATION_DUPLICATE_WINDOW_MINUTES');
    expect(serviceSource).toContain('duplicateCampaign: true');
    expect(serviceSource).toContain('No duplicate notifications or SMS were sent.');
  });

  it('allows hospital staff default RBAC permissions to satisfy mobilization authorization', () => {
    expect(ROLE_PERMISSION_DEFAULTS[Role.HOSPITAL_ADMIN]).toEqual(
      expect.arrayContaining([
        PermissionCode.INVENTORY_REPORT_VIEW,
        PermissionCode.DONOR_MATCH_VIEW,
      ]),
    );
    expect(ROLE_PERMISSION_DEFAULTS[Role.DONOR]).not.toContain(PermissionCode.DONOR_MATCH_VIEW);
  });
});
