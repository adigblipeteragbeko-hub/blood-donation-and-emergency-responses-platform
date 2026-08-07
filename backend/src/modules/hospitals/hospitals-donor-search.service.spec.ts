import { describe, expect, it, jest } from '@jest/globals';
import { BloodGroup, DonorClinicalStatus, RequestSource, RequestStatus } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { HospitalsService } from './hospitals.service';
import { getCompatibleDonorGroups } from '../../common/utils/blood-compatibility';

const now = new Date();
const hospital = {
  id: 'hospital-1',
  hospitalName: 'Tema General Hospital',
  location: 'Tema',
  city: 'Tema',
  region: 'Greater Accra',
  latitude: 5.67,
  longitude: -0.02,
};
const requestHospital = {
  id: 'hospital-2',
  hospitalName: 'Ho Teaching Hospital',
  location: 'Ho',
  city: 'Ho',
  region: 'Volta',
  latitude: 6.61,
  longitude: 0.47,
};

function makeDonor(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id ?? 'donor-1',
    donorNumber: overrides.donorNumber ?? 'DNR-001',
    fullName: overrides.fullName ?? 'Ada Donor',
    firstName: 'Ada',
    otherNames: null,
    surname: 'Donor',
    phone: '0200000000',
    alternativePhoneNumber: null,
    bloodGroup: overrides.bloodGroup ?? BloodGroup.O_POS,
    location: 'Tema',
    emergencyContactPhone: '0300000000',
    emergencyContactRelationship: 'Sibling',
    availabilityStatus: overrides.availabilityStatus ?? true,
    eligibilityStatus: overrides.eligibilityStatus ?? true,
    lastDonationDate: null,
    nextEligibilityDate: overrides.nextEligibilityDate ?? null,
    latitude: overrides.latitude ?? 5.68,
    longitude: overrides.longitude ?? -0.03,
    areaCommunity: 'Community 1',
    city: 'Tema',
    region: 'Greater Accra',
    locationSharingEnabled: overrides.locationSharingEnabled ?? true,
    lastLocationUpdateAt: overrides.lastLocationUpdateAt ?? new Date(now.getTime() - 10 * 60_000),
    notificationEmailEnabled: overrides.notificationEmailEnabled ?? true,
    notificationSmsEnabled: overrides.notificationSmsEnabled ?? false,
    preferredHospital: null,
    donationHistory: overrides.donationHistory ?? [],
    donorResponses: [],
    clinicalRecords: overrides.clinicalRecords ?? [
      {
        status: DonorClinicalStatus.APPROVED,
        finalDecisionAt: now,
        officeCompletedAt: now,
        clinicalReview: null,
      },
    ],
  };
}

function makeService(args: { donors?: any[]; activeRequest?: any | null; hospitalOverride?: any } = {}) {
  const prisma = {
    donor: { findMany: jest.fn(async () => args.donors ?? [makeDonor()]) },
    bloodRequest: { findFirst: jest.fn(async () => args.activeRequest ?? null) },
  };
  const hospitalAccess = {
    getHospitalForUser: jest.fn(async () => args.hospitalOverride ?? hospital),
  };
  const service = new HospitalsService(prisma as any, {} as any, hospitalAccess as any, {} as any, {} as any);
  return { service, prisma, hospitalAccess };
}

function makeRequest(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id ?? 'request-1',
    requestReference: 'REQ-001',
    bloodGroup: overrides.bloodGroup ?? BloodGroup.O_POS,
    unitsNeeded: 2,
    priority: 'CRITICAL',
    requestSource: overrides.requestSource ?? RequestSource.DONORS_AND_HOSPITALS,
    type: 'EMERGENCY',
    location: 'Ho',
    emergencyLocation: 'Ho Emergency Unit',
    city: 'Ho',
    region: 'Volta',
    latitude: overrides.latitude ?? 6.61,
    longitude: overrides.longitude ?? 0.47,
    hospitalId: overrides.hospitalId ?? requestHospital.id,
    hospital: overrides.hospital ?? requestHospital,
  };
}

describe('HospitalsService.searchDonors', () => {
  it('accepts a logged-in hospital request context and uses it server-side', async () => {
    const activeRequest = makeRequest({ hospitalId: hospital.id, hospital });
    const { service, prisma } = makeService({ activeRequest, donors: [makeDonor({ bloodGroup: BloodGroup.O_POS })] });

    const result = await service.searchDonors('user-1', {
      requestId: activeRequest.id,
      bloodGroup: BloodGroup.AB_POS,
      matchMode: 'EXACT',
      radiusKm: 25,
    } as any);

    expect(prisma.bloodRequest.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: activeRequest.id }) }));
    expect(prisma.donor.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ bloodGroup: { in: [BloodGroup.O_POS] } }) }));
    expect(result.summary.requestContext!.interHospital).toBe(false);
    expect(result.donors[0].bloodGroup).toBe(BloodGroup.O_POS);
  });

  it('accepts authorized inter-hospital requests and exposes both hospital labels', async () => {
    const { service } = makeService({ activeRequest: makeRequest(), donors: [makeDonor()] });

    const result = await service.searchDonors('user-1', { requestId: 'request-1', bloodGroup: BloodGroup.A_NEG } as any);

    expect(result.summary.requestContext!.interHospital).toBe(true);
    expect(result.summary.requestContext!.loggedInHospital.hospitalName).toBe('Tema General Hospital');
    expect(result.summary.requestContext!.requestingHospital.hospitalName).toBe('Ho Teaching Hospital');
    expect(result.summary.origin!.source).toBe('request');
  });

  it('rejects unauthorized or invalid request IDs with a controlled exception', async () => {
    const { service } = makeService({ activeRequest: null });

    await expect(service.searchDonors('user-1', { requestId: 'missing' } as any)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('uses existing compatibility utility for compatible matching', async () => {
    const { service, prisma } = makeService({ donors: [makeDonor({ bloodGroup: BloodGroup.O_NEG })] });

    await service.searchDonors('user-1', { bloodGroup: BloodGroup.O_POS, matchMode: 'COMPATIBLE' } as any);

    expect(prisma.donor.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ bloodGroup: { in: getCompatibleDonorGroups(BloodGroup.O_POS) } }),
    }));
  });

  it('filters unavailable, cooling-period, and no-consent donors from available emergency results', async () => {
    const { service } = makeService({
      donors: [
        makeDonor({ id: 'available' }),
        makeDonor({ id: 'cooling', nextEligibilityDate: new Date(now.getTime() + 86_400_000) }),
        makeDonor({ id: 'no-consent', notificationEmailEnabled: false, notificationSmsEnabled: false }),
        makeDonor({ id: 'unavailable', availabilityStatus: false }),
      ],
    });

    const result = await service.searchDonors('user-1', {
      bloodGroup: BloodGroup.O_POS,
      availabilityFilter: 'AVAILABLE_ONLY',
      emergencyMode: true,
    } as any);

    expect(result.donors.map((donor: any) => donor.id)).toEqual(['available']);
  });

  it('excludes unapproved donors through the Prisma clinical-record criteria', async () => {
    const { service, prisma } = makeService();

    await service.searchDonors('user-1', { bloodGroup: BloodGroup.O_POS } as any);

    expect(prisma.donor.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        clinicalRecords: expect.objectContaining({ some: { status: DonorClinicalStatus.APPROVED } }),
        NOT: { bloodGroup: 'UNKNOWN' },
        user: { isActive: true, emailVerified: true },
      }),
    }));
  });

  it('applies radius filtering from the resolved backend origin', async () => {
    const { service } = makeService({
      donors: [
        makeDonor({ id: 'near', latitude: 5.68, longitude: -0.03 }),
        makeDonor({ id: 'far', latitude: 7.9, longitude: -1.0 }),
      ],
    });

    const result = await service.searchDonors('user-1', { bloodGroup: BloodGroup.O_POS, radiusKm: 20 } as any);

    expect(result.donors.map((donor: any) => donor.id)).toEqual(['near']);
    expect(result.donors[0].distanceKm).toEqual(expect.any(Number));
  });

  it('rounds map coordinates and does not expose exact donor coordinates', async () => {
    const { service } = makeService({
      donors: [makeDonor({ latitude: 5.67891, longitude: -0.02345 })],
    });

    const result = await service.searchDonors('user-1', { bloodGroup: BloodGroup.O_POS } as any);

    expect(result.donors[0].latitude).toBe(5.679);
    expect(result.donors[0].longitude).toBe(-0.023);
  });

  it('marks stale locations older than six hours and includes match reasons', async () => {
    const { service } = makeService({
      donors: [makeDonor({ lastLocationUpdateAt: new Date(now.getTime() - 7 * 60 * 60_000) })],
    });

    const result = await service.searchDonors('user-1', { bloodGroup: BloodGroup.O_POS } as any);

    expect(result.donors[0].locationFreshness.status).toBe('STALE');
    expect(result.summary.staleLocationCount).toBe(1);
    expect(result.donors[0].matchReasons).toContain('location update is stale');
    expect(result.donors[0].matchReasonSummary).toContain('O+ is an exact match');
  });

  it('handles donors without usable coordinates without failing', async () => {
    const { service } = makeService({
      donors: [makeDonor({ latitude: null, longitude: null, locationSharingEnabled: false })],
    });

    const result = await service.searchDonors('user-1', { bloodGroup: BloodGroup.O_POS } as any);

    expect(result.donors).toHaveLength(1);
    expect(result.donors[0].mapLocationAvailable).toBe(false);
    expect(result.donors[0].distanceKm).toBeNull();
  });

  it('returns a valid empty response when no donors match', async () => {
    const { service } = makeService({ donors: [] });

    const result = await service.searchDonors('user-1', { bloodGroup: BloodGroup.O_POS } as any);

    expect(result.donors).toEqual([]);
    expect(result.summary.totalMatches).toBe(0);
  });
});
