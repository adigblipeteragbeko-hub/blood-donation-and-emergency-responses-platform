import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BloodGroup, DonorClinicalStatus, RequestSource, RequestStatus, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { AuditService } from '../../common/audit/audit.service';
import { GeocodingService } from '../../common/maps/geocoding.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { HospitalAccessService } from '../../common/rbac/hospital-access.service';
import { RealtimeService } from '../../common/realtime/realtime.service';
import { PrismaService } from '../../prisma.service';
import { CreateHospitalAdminDto } from './dto/admin/create-hospital-admin.dto';
import { UpdateHospitalAdminDto } from './dto/admin/update-hospital-admin.dto';
import { ApproveDonorEligibilityDto } from './dto/approve-donor-eligibility.dto';
import { DonorSearchDto } from './dto/donor-search.dto';
import { SubmitOfficeUseDto } from './dto/submit-office-use.dto';
import { UpsertHospitalProfileDto } from './dto/upsert-hospital-profile.dto';
import { getCompatibleDonorGroups } from '../../common/utils/blood-compatibility';
import { normalizeEmail } from '../../common/utils/email-normalization';

const BLOOD_GROUP_CODES = ['O_POS', 'O_NEG', 'A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG'] as const;
const DEFERRED_STATUSES: DonorClinicalStatus[] = [
  DonorClinicalStatus.REJECTED,
  DonorClinicalStatus.PERMANENTLY_DEFERRED,
];
const LOCATION_FRESHNESS_THRESHOLD_HOURS = 6;

@Injectable()
export class HospitalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly hospitalAccess: HospitalAccessService,
    private readonly geocoding: GeocodingService,
    private readonly realtime: RealtimeService,
  ) {}

  private validateCompleteMapLocation(input: {
    city?: string | null;
    region?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  }) {
    if (!input.city?.trim() || !input.region?.trim()) {
      throw new BadRequestException('City and region are required for hospital emergency map coordination.');
    }
    if (typeof input.latitude !== 'number' || typeof input.longitude !== 'number') {
      throw new BadRequestException('Latitude and longitude are required for hospital emergency map coordination.');
    }
  }

  async upsertProfile(userId: string, dto: UpsertHospitalProfileDto) {
    const geocoded =
      typeof dto.latitude === 'number' && typeof dto.longitude === 'number'
        ? null
        : await this.geocoding.geocodeHospitalAddress({
            hospitalName: dto.hospitalName,
            address: dto.address,
            city: dto.city,
            region: dto.region,
            location: dto.location,
          });

    const resolvedLatitude = dto.latitude ?? geocoded?.latitude ?? null;
    const resolvedLongitude = dto.longitude ?? geocoded?.longitude ?? null;
    this.validateCompleteMapLocation({
      city: dto.city,
      region: dto.region,
      latitude: resolvedLatitude,
      longitude: resolvedLongitude,
    });
    if (resolvedLatitude === null || resolvedLongitude === null) {
      throw new BadRequestException(
        'Unable to locate this hospital automatically. Please enter latitude and longitude manually.',
      );
    }

    const hospital = await this.prisma.hospital.upsert({
      where: { userId },
      update: {
        ...dto,
        city: dto.city.trim(),
        region: dto.region.trim(),
        latitude: resolvedLatitude,
        longitude: resolvedLongitude,
      },
      create: {
        ...dto,
        userId,
        city: dto.city.trim(),
        region: dto.region.trim(),
        latitude: resolvedLatitude,
        longitude: resolvedLongitude,
      },
    });

    await this.audit.log('HOSPITAL_PROFILE_UPSERTED', 'HOSPITAL', userId, hospital.id, dto);
    this.realtime.broadcastHospitalMapUpdate({
      reason: 'hospital.profile.updated',
      hospitalId: hospital.id,
      hospitalName: hospital.hospitalName,
      latitude: hospital.latitude,
      longitude: hospital.longitude,
    });
    return hospital;
  }

  async getProfile(userId: string) {
    const hospitalMembership = await this.hospitalAccess.getHospitalForUser(userId);
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalMembership.id },
      include: { bloodRequests: true, inventoryItems: true },
    });

    if (!hospital) {
      throw new NotFoundException('Hospital profile not found');
    }

    return hospital;
  }

  private validateLogo(logoUrl: string) {
    if (
      logoUrl &&
      !logoUrl.startsWith('data:image/jpeg;base64,') &&
      !logoUrl.startsWith('data:image/png;base64,') &&
      !logoUrl.startsWith('data:image/webp;base64,') &&
      !/^https?:\/\//i.test(logoUrl)
    ) {
      throw new BadRequestException('Hospital logo must be a JPG, PNG, WebP, or secure hosted image URL.');
    }
  }

  async updateLogo(userId: string, logoUrl: string) {
    this.validateLogo(logoUrl);
    const hospitalMembership = await this.hospitalAccess.getHospitalForUser(userId);
    const hospital = await this.prisma.hospital.update({
      where: { id: hospitalMembership.id },
      data: {
        logoUrl: logoUrl || null,
        logoUpdatedAt: logoUrl ? new Date() : null,
      },
      include: { bloodRequests: true, inventoryItems: true },
    });

    await this.audit.log('HOSPITAL_LOGO_UPDATED', 'HOSPITAL', userId, hospital.id, {
      hasLogo: Boolean(logoUrl),
    });

    this.realtime.broadcastHospitalMapUpdate({
      reason: 'hospital.logo.updated',
      hospitalId: hospital.id,
      hospitalName: hospital.hospitalName,
    });

    return hospital;
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

  private approximateCoordinate(value: number | null) {
    return typeof value === 'number' ? Number(value.toFixed(3)) : null;
  }

  private formatBloodGroup(value?: BloodGroup | null) {
    return String(value ?? '').replace('_POS', '+').replace('_NEG', '-');
  }

  private getLocationFreshness(lastLocationUpdateAt?: Date | null) {
    if (!lastLocationUpdateAt) {
      return {
        status: 'UNAVAILABLE',
        label: 'Location not available',
        ageMinutes: null,
        thresholdHours: LOCATION_FRESHNESS_THRESHOLD_HOURS,
      };
    }

    const ageMinutes = Math.max(0, Math.floor((Date.now() - lastLocationUpdateAt.getTime()) / (60 * 1000)));
    const stale = ageMinutes > LOCATION_FRESHNESS_THRESHOLD_HOURS * 60;
    return {
      status: stale ? 'STALE' : 'FRESH',
      label: stale
        ? 'Location is stale'
        : ageMinutes < 60
          ? `Updated ${ageMinutes || 1} minute${ageMinutes === 1 ? '' : 's'} ago`
          : `Updated ${Math.floor(ageMinutes / 60)} hour${Math.floor(ageMinutes / 60) === 1 ? '' : 's'} ago`,
      ageMinutes,
      thresholdHours: LOCATION_FRESHNESS_THRESHOLD_HOURS,
    };
  }

  async searchDonors(userId: string, query: DonorSearchDto) {
    const hospital = await this.hospitalAccess.getHospitalForUser(userId);
    const activeRequest = query.requestId
      ? await this.prisma.bloodRequest.findFirst({
          where: {
            id: query.requestId,
            status: { in: [RequestStatus.OPEN, RequestStatus.MATCHING] },
            OR: [
              { hospitalId: hospital.id },
              {
                hospitalId: { not: hospital.id },
                requestSource: { in: [RequestSource.HOSPITALS_ONLY, RequestSource.DONORS_AND_HOSPITALS] },
              },
            ],
          },
          select: {
            id: true,
            requestReference: true,
            bloodGroup: true,
            unitsNeeded: true,
            priority: true,
            requestSource: true,
            type: true,
            location: true,
            emergencyLocation: true,
            city: true,
            region: true,
            latitude: true,
            longitude: true,
            hospitalId: true,
            hospital: { select: { id: true, hospitalName: true, location: true, city: true, region: true, latitude: true, longitude: true } },
          },
        })
      : null;
    if (query.requestId && !activeRequest) {
      throw new NotFoundException('Emergency request context was not found or is not available to your hospital.');
    }
    const locationFilter = query.location?.trim();
    const now = new Date();
    const requestedGroup = activeRequest?.bloodGroup ?? (query.bloodGroup && query.bloodGroup !== BloodGroup.UNKNOWN ? query.bloodGroup : undefined);
    const bloodGroups = requestedGroup
      ? query.matchMode === 'COMPATIBLE'
        ? getCompatibleDonorGroups(requestedGroup)
        : [requestedGroup]
      : BLOOD_GROUP_CODES as unknown as BloodGroup[];
    const originLatitude = typeof activeRequest?.latitude === 'number'
      ? activeRequest.latitude
      : typeof activeRequest?.hospital.latitude === 'number'
        ? activeRequest.hospital.latitude
        : typeof query.latitude === 'number'
          ? query.latitude
          : hospital.latitude ?? undefined;
    const originLongitude = typeof activeRequest?.longitude === 'number'
      ? activeRequest.longitude
      : typeof activeRequest?.hospital.longitude === 'number'
        ? activeRequest.hospital.longitude
        : typeof query.longitude === 'number'
          ? query.longitude
          : hospital.longitude ?? undefined;
    const hasOrigin = typeof originLatitude === 'number' && typeof originLongitude === 'number';
    const radiusKm = query.radiusKm ?? 25;
    const availabilityFilter = query.availabilityFilter ?? 'AVAILABLE_ONLY';
    const includeDeferred = availabilityFilter === 'INCLUDE_DEFERRED';

    const donors = await this.prisma.donor.findMany({
      where: {
        bloodGroup: { in: bloodGroups },
        NOT: { bloodGroup: 'UNKNOWN' },
        user: {
          isActive: true,
          emailVerified: true,
        },
        clinicalRecords: {
          some: {
            status: includeDeferred
              ? { in: [DonorClinicalStatus.APPROVED, DonorClinicalStatus.TEMPORARILY_DEFERRED] }
              : DonorClinicalStatus.APPROVED,
          },
          none: {
            status: { in: DEFERRED_STATUSES },
          },
        },
        OR: locationFilter
          ? [
              { location: { contains: locationFilter, mode: 'insensitive' } },
              { areaCommunity: { contains: locationFilter, mode: 'insensitive' } },
              { city: { contains: locationFilter, mode: 'insensitive' } },
              { region: { contains: locationFilter, mode: 'insensitive' } },
            ]
          : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: 250,
      select: {
        id: true,
        donorNumber: true,
        fullName: true,
        firstName: true,
        otherNames: true,
        surname: true,
        phone: true,
        alternativePhoneNumber: true,
        bloodGroup: true,
        location: true,
        emergencyContactPhone: true,
        emergencyContactRelationship: true,
        availabilityStatus: true,
        eligibilityStatus: true,
        lastDonationDate: true,
        nextEligibilityDate: true,
        latitude: true,
        longitude: true,
        areaCommunity: true,
        city: true,
        region: true,
        locationSharingEnabled: true,
        lastLocationUpdateAt: true,
        notificationEmailEnabled: true,
        notificationSmsEnabled: true,
        preferredHospital: { select: { id: true, hospitalName: true, location: true, city: true, region: true } },
        donationHistory: {
          select: { donatedAt: true },
          orderBy: { donatedAt: 'desc' },
        },
        donorResponses: { select: { responseStatus: true } },
        clinicalRecords: {
          select: {
            status: true,
            finalDecisionAt: true,
            officeCompletedAt: true,
            clinicalReview: { select: { temporaryDeferralDuration: true, comments: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    }) as any[];

    const decorated = donors.map((donor) => {
      const latestClinical = donor.clinicalRecords[0] ?? null;
      const deferred = latestClinical?.status === DonorClinicalStatus.TEMPORARILY_DEFERRED;
      const nextEligible = donor.nextEligibilityDate ?? null;
      const cooldown = Boolean(nextEligible && nextEligible > now);
      const cooldownDaysRemaining = cooldown
        ? Math.max(1, Math.ceil((nextEligible!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
        : 0;
      const cooldownEndingSoon = cooldownDaysRemaining > 0 && cooldownDaysRemaining <= 14;
      const mapEligible = donor.locationSharingEnabled && typeof donor.latitude === 'number' && typeof donor.longitude === 'number';
      const distanceKm = hasOrigin && mapEligible
        ? Number(this.distanceKm(originLatitude!, originLongitude!, donor.latitude!, donor.longitude!).toFixed(2))
        : null;
      const totalResponses = donor.donorResponses.length;
      const positiveResponses = donor.donorResponses.filter((response: { responseStatus: string }) => ['ACCEPTED', 'DONATED'].includes(response.responseStatus)).length;
      const responseRate = totalResponses > 0 ? Math.round((positiveResponses / totalResponses) * 100) : null;
      const available = donor.availabilityStatus && donor.eligibilityStatus && !cooldown && !deferred;
      const alertConsent = donor.notificationEmailEnabled || donor.notificationSmsEnabled;
      const status = deferred
        ? 'DEFERRED'
        : cooldownEndingSoon
          ? 'COOLDOWN_ENDING_SOON'
          : cooldown
            ? 'COOLDOWN'
            : available
            ? 'AVAILABLE'
            : 'UNAVAILABLE';
      const locationFreshness = this.getLocationFreshness(donor.lastLocationUpdateAt);
      const matchReasons = [
        requestedGroup
          ? donor.bloodGroup === requestedGroup
            ? `${this.formatBloodGroup(donor.bloodGroup)} is an exact match for the requested blood group`
            : `${this.formatBloodGroup(donor.bloodGroup)} is compatible with ${this.formatBloodGroup(requestedGroup)} by platform rules`
          : 'Blood group is confirmed',
        latestClinical?.status === DonorClinicalStatus.APPROVED ? 'eligibility is hospital-approved' : 'eligibility is not fully approved',
        cooldown ? `cooling period ends in ${cooldownDaysRemaining} day(s)` : 'cooling period is complete',
        available ? 'donor is currently available' : 'donor is not currently available',
        alertConsent ? 'emergency notifications are enabled' : 'emergency notifications are not enabled',
        mapEligible ? 'secure location sharing is enabled' : 'usable map location is unavailable',
        distanceKm !== null
          ? distanceKm <= radiusKm
            ? `within ${radiusKm} km of the search origin`
            : `outside the selected ${radiusKm} km radius`
          : 'distance cannot be calculated',
        locationFreshness.status === 'FRESH'
          ? 'location update is fresh'
          : locationFreshness.status === 'STALE'
            ? 'location update is stale'
            : 'location update is unavailable',
      ];

      return {
        id: donor.id,
        donorNumber: donor.donorNumber,
        fullName: donor.fullName,
        firstName: donor.firstName,
        otherNames: donor.otherNames,
        surname: donor.surname,
        phone: available ? donor.phone : null,
        alternativePhoneNumber: available ? donor.alternativePhoneNumber : null,
        bloodGroup: donor.bloodGroup,
        matchType: requestedGroup && donor.bloodGroup === requestedGroup ? 'EXACT' : 'COMPATIBLE',
        location: donor.location,
        areaCommunity: donor.areaCommunity,
        city: donor.city,
        region: donor.region,
        emergencyContactPhone: available ? donor.emergencyContactPhone : '',
        emergencyContactRelationship: available ? donor.emergencyContactRelationship : null,
        availabilityStatus: donor.availabilityStatus,
        eligibilityStatus: donor.eligibilityStatus,
        operationalStatus: status,
        contactAllowed: available,
        scheduleAllowed: available,
        lastDonationDate: donor.lastDonationDate,
        nextEligibilityDate: donor.nextEligibilityDate,
        cooldownDaysRemaining,
        previousDonationCount: donor.donationHistory.length,
        responseRate,
        responseRateLabel: responseRate === null ? 'Not enough data' : `${responseRate}%`,
        preferredHospital: donor.preferredHospital,
        distanceKm,
        withinRadius: distanceKm !== null ? distanceKm <= radiusKm : null,
        locationSharingEnabled: donor.locationSharingEnabled,
        mapLocationAvailable: mapEligible,
        latitude: mapEligible ? this.approximateCoordinate(donor.latitude) : null,
        longitude: mapEligible ? this.approximateCoordinate(donor.longitude) : null,
        lastLocationUpdateAt: donor.lastLocationUpdateAt,
        locationFreshness,
        emergencyNotificationConsent: alertConsent,
        matchReasons,
        matchReasonSummary: matchReasons.join(', ') + '.',
        clinicalStatus: latestClinical?.status ?? null,
        temporaryDeferralDuration: latestClinical?.clinicalReview?.temporaryDeferralDuration ?? null,
      };
    });

    const visible = decorated.filter((donor) => {
      if (query.emergencyMode && !donor.emergencyNotificationConsent) return false;
      if (donor.operationalStatus === 'DEFERRED') return includeDeferred;
      if (availabilityFilter === 'AVAILABLE_ONLY') return donor.operationalStatus === 'AVAILABLE';
      if (availabilityFilter === 'INCLUDE_COOLDOWN') return ['AVAILABLE', 'COOLDOWN', 'COOLDOWN_ENDING_SOON'].includes(donor.operationalStatus);
      if (availabilityFilter === 'ALL_APPROVED') return donor.clinicalStatus === DonorClinicalStatus.APPROVED;
      return donor.operationalStatus !== 'UNAVAILABLE';
    });

    const sorted = [...visible].sort((a, b) => {
      if (query.emergencyMode) {
        const statusRank = { AVAILABLE: 0, COOLDOWN_ENDING_SOON: 1, COOLDOWN: 2, DEFERRED: 3, UNAVAILABLE: 4 } as Record<string, number>;
        const statusDelta = (statusRank[a.operationalStatus] ?? 9) - (statusRank[b.operationalStatus] ?? 9);
        if (statusDelta !== 0) return statusDelta;
        if (a.matchType !== b.matchType) return a.matchType === 'EXACT' ? -1 : 1;
        if (a.locationFreshness.status !== b.locationFreshness.status) return a.locationFreshness.status === 'FRESH' ? -1 : 1;
      }
      return (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY);
    });

    const withinRadius = hasOrigin && radiusKm
      ? sorted.filter((donor) => donor.distanceKm !== null && donor.distanceKm <= radiusKm)
      : sorted;
    const radiusFallbackApplied = Boolean(hasOrigin && radiusKm && sorted.length > 0 && withinRadius.length === 0);
    const finalResults = radiusFallbackApplied ? sorted.slice(0, 10) : withinRadius;
    const visibleIds = new Set(visible.map((donor) => donor.id));
    const finalIds = new Set(finalResults.map((donor) => donor.id));
    const exclusionSummary = {
      clinicalApprovalMissing: 0,
      notCurrentlyAvailable: decorated.filter((donor) => !visibleIds.has(donor.id) && donor.operationalStatus === 'UNAVAILABLE').length,
      coolingPeriod: decorated.filter((donor) => !visibleIds.has(donor.id) && ['COOLDOWN', 'COOLDOWN_ENDING_SOON'].includes(donor.operationalStatus)).length,
      deferred: decorated.filter((donor) => !visibleIds.has(donor.id) && donor.operationalStatus === 'DEFERRED').length,
      outsideRadius: hasOrigin && radiusKm ? sorted.filter((donor) => !finalIds.has(donor.id) && donor.distanceKm !== null && donor.distanceKm > radiusKm).length : 0,
      missingOrStaleLocation: sorted.filter((donor) => !finalIds.has(donor.id) && (donor.locationFreshness.status !== 'FRESH' || donor.distanceKm === null)).length,
      bloodGroupIncompatible: 0,
      emergencyConsentMissing: decorated.filter((donor) => !visibleIds.has(donor.id) && query.emergencyMode && !donor.emergencyNotificationConsent).length,
    };

    return {
      donors: finalResults,
      summary: {
        evaluatedDonors: decorated.length,
        totalMatches: finalResults.length,
        totalBeforeRadius: sorted.length,
        availableCount: finalResults.filter((donor) => donor.operationalStatus === 'AVAILABLE').length,
        cooldownCount: finalResults.filter((donor) => donor.operationalStatus === 'COOLDOWN' || donor.operationalStatus === 'COOLDOWN_ENDING_SOON').length,
        deferredCount: finalResults.filter((donor) => donor.operationalStatus === 'DEFERRED').length,
        mapReadyCount: finalResults.filter((donor) => donor.mapLocationAvailable).length,
        staleLocationCount: finalResults.filter((donor) => donor.locationFreshness.status === 'STALE').length,
        origin: hasOrigin
          ? {
              latitude: originLatitude,
              longitude: originLongitude,
              source: activeRequest ? 'request' : typeof query.latitude === 'number' && typeof query.longitude === 'number' ? 'query' : 'hospital',
              hospitalName: activeRequest?.hospital.hospitalName ?? hospital.hospitalName,
              location: activeRequest?.emergencyLocation ?? activeRequest?.location ?? hospital.location,
            }
          : null,
        requestContext: activeRequest
          ? {
              id: activeRequest.id,
              requestReference: activeRequest.requestReference,
              bloodGroup: activeRequest.bloodGroup,
              bloodComponent: 'Whole blood',
              unitsNeeded: activeRequest.unitsNeeded,
              priority: activeRequest.priority,
              requestSource: activeRequest.requestSource,
              type: activeRequest.type,
              location: activeRequest.emergencyLocation ?? activeRequest.location,
              city: activeRequest.city,
              region: activeRequest.region,
              requestingHospital: activeRequest.hospital,
              loggedInHospital: {
                id: hospital.id,
                hospitalName: hospital.hospitalName,
                location: hospital.location,
                city: hospital.city,
                region: hospital.region,
              },
              interHospital: activeRequest.hospitalId !== hospital.id,
            }
          : null,
        radiusFallback: {
          applied: radiusFallbackApplied,
          requestedRadiusKm: radiusKm,
        },
        exclusionSummary,
      },
    };
  }

  async getTypeaheadSuggestions(userId: string, rawQuery: string) {
    const query = rawQuery.trim();
    const normalizedQuery = query.toUpperCase();
    const bloodGroupQuery = BLOOD_GROUP_CODES.includes(normalizedQuery as (typeof BLOOD_GROUP_CODES)[number])
      ? (normalizedQuery as BloodGroup)
      : undefined;

    if (!query) {
      return {
        hospitals: [],
        donors: [],
        bloodGroups: [],
        locations: [],
        emergencyRequests: [],
        inventory: [],
        donationCenters: [],
      };
    }

    await this.getHospitalByUser(userId);

    const [hospitals, donors, requests, inventory] = await Promise.all([
      this.prisma.hospital.findMany({
        where: {
          OR: [
            { hospitalName: { contains: query, mode: 'insensitive' } },
            { location: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true, hospitalName: true, location: true },
        take: 8,
        orderBy: { hospitalName: 'asc' },
      }),
      this.prisma.donor.findMany({
        where: {
          NOT: { bloodGroup: 'UNKNOWN' },
          OR: [
            { fullName: { contains: query, mode: 'insensitive' } },
            { location: { contains: query, mode: 'insensitive' } },
            { city: { contains: query, mode: 'insensitive' } },
            { region: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true, fullName: true, bloodGroup: true, location: true },
        take: 8,
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.bloodRequest.findMany({
        where: {
          OR: [
            { patientName: { contains: query, mode: 'insensitive' } },
            { requestReference: { contains: query, mode: 'insensitive' } },
            { hospitalPatientReference: { contains: query, mode: 'insensitive' } },
            { patientCode: { contains: query, mode: 'insensitive' } },
            { hospitalCenterName: { contains: query, mode: 'insensitive' } },
            { emergencyLocation: { contains: query, mode: 'insensitive' } },
            { location: { contains: query, mode: 'insensitive' } },
            { city: { contains: query, mode: 'insensitive' } },
            { region: { contains: query, mode: 'insensitive' } },
            { ward: { contains: query, mode: 'insensitive' } },
            ...(bloodGroupQuery ? [{ bloodGroup: { equals: bloodGroupQuery } }] : []),
          ],
          type: 'EMERGENCY',
        },
        select: {
          id: true,
          bloodGroup: true,
          location: true,
          emergencyLocation: true,
          city: true,
          region: true,
          unitsNeeded: true,
          priority: true,
        },
        take: 8,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.inventoryItem.findMany({
        where: {
          OR: [
            { hospital: { hospitalName: { contains: query, mode: 'insensitive' } } },
            { hospital: { location: { contains: query, mode: 'insensitive' } } },
            ...(bloodGroupQuery ? [{ bloodGroup: { equals: bloodGroupQuery } }] : []),
          ],
        },
        select: {
          id: true,
          bloodGroup: true,
          availableUnits: true,
          hospital: { select: { hospitalName: true, location: true } },
        },
        take: 8,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const bloodGroups = ['O_POS', 'O_NEG', 'A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG'].filter((group) =>
      group.toLowerCase().includes(query.toLowerCase()),
    );

    const locations = Array.from(
      new Set(
        [
          ...hospitals.map((h) => h.location),
          ...donors.map((d) => d.location),
          ...requests.map((r) => r.emergencyLocation ?? r.location),
          ...requests.map((r) => [r.city, r.region].filter(Boolean).join(', ')),
        ].filter(Boolean),
      ),
    ).slice(0, 8);

    return {
      hospitals,
      donors,
      bloodGroups,
      locations,
      emergencyRequests: requests,
      inventory,
      donationCenters: hospitals,
    };
  }

  async listPublicCenters(query: PaginationQueryDto) {
    const skip = query.skip ?? 0;
    const take = Math.min(query.take ?? 50, 100);

    const hospitals = await this.prisma.hospital.findMany({
      where: {
        isApproved: true,
        bloodBankAvailable: true,
      },
      orderBy: [{ hospitalName: 'asc' }],
      skip,
      take,
      select: {
        id: true,
        hospitalName: true,
        location: true,
        address: true,
        contactPhone: true,
        city: true,
        region: true,
        isApproved: true,
        bloodBankAvailable: true,
        latitude: true,
        longitude: true,
        inventoryItems: {
          where: { availableUnits: { gt: 0 } },
          select: { bloodGroup: true, availableUnits: true },
        },
      },
    });

    return hospitals.map((hospital) => ({
      id: hospital.id,
      hospitalName: hospital.hospitalName,
      location: hospital.location,
      address: hospital.address,
      contactPhone: hospital.contactPhone,
      city: hospital.city,
      region: hospital.region,
      bloodBankAvailable: hospital.bloodBankAvailable,
      emergencyReady: hospital.bloodBankAvailable && hospital.isApproved,
      availableBloodGroups: hospital.inventoryItems.map((item) => item.bloodGroup),
      latitude: hospital.latitude,
      longitude: hospital.longitude,
      mapsUrl:
        hospital.latitude !== null && hospital.longitude !== null
          ? `https://www.google.com/maps?q=${hospital.latitude},${hospital.longitude}`
          : `https://www.google.com/maps?q=${encodeURIComponent(
              `${hospital.hospitalName} ${hospital.address} ${hospital.location}`,
            )}`,
    }));
  }

  listAllForAdmin(query: PaginationQueryDto) {
    const skip = query.skip ?? 0;
    const take = query.take ?? 100;
    return this.prisma.hospital.findMany({
      include: {
        user: { select: { id: true, email: true, role: true, isActive: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  async createByAdmin(dto: CreateHospitalAdminDto, actorUserId: string) {
    const email = normalizeEmail(dto.email);
    const existing = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('Email already exists');
    }

    const geocoded =
      typeof dto.latitude === 'number' && typeof dto.longitude === 'number'
        ? null
        : await this.geocoding.geocodeHospitalAddress({
            hospitalName: dto.hospitalName,
            address: dto.address,
            city: dto.city,
            region: dto.region,
            location: dto.location,
          });

    const resolvedLatitude = dto.latitude ?? geocoded?.latitude ?? null;
    const resolvedLongitude = dto.longitude ?? geocoded?.longitude ?? null;
    this.validateCompleteMapLocation({
      city: dto.city,
      region: dto.region,
      latitude: resolvedLatitude,
      longitude: resolvedLongitude,
    });
    if (resolvedLatitude === null || resolvedLongitude === null) {
      throw new BadRequestException(
        'Unable to locate this hospital automatically. Please enter latitude and longitude manually.',
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash: await argon2.hash(dto.password),
          role: Role.HOSPITAL_ADMIN,
          emailVerified: true,
        },
      });

      const hospital = await tx.hospital.create({
        data: {
          userId: user.id,
          hospitalName: dto.hospitalName,
          registrationCode: dto.registrationCode,
          address: dto.address,
          location: dto.location,
          city: dto.city.trim(),
          region: dto.region.trim(),
          latitude: resolvedLatitude,
          longitude: resolvedLongitude,
          bloodBankAvailable: dto.bloodBankAvailable ?? true,
          contactName: dto.contactName,
          contactPhone: dto.contactPhone,
        },
        include: {
          user: { select: { id: true, email: true, role: true, isActive: true } },
        },
      });

      return hospital;
    });

    await this.audit.log('HOSPITAL_CREATED_BY_ADMIN', 'HOSPITAL', actorUserId, created.id, { email });
    this.realtime.broadcastHospitalMapUpdate({
      reason: 'hospital.created',
      hospitalId: created.id,
      hospitalName: created.hospitalName,
      latitude: created.latitude,
      longitude: created.longitude,
    });
    return created;
  }

  async updateByAdmin(hospitalId: string, dto: UpdateHospitalAdminDto, actorUserId: string) {
    const hospital = await this.prisma.hospital.findUnique({ where: { id: hospitalId } });
    if (!hospital) {
      throw new NotFoundException('Hospital not found');
    }

    const geocoded =
      typeof dto.latitude === 'number' && typeof dto.longitude === 'number'
        ? null
        : await this.geocoding.geocodeHospitalAddress({
            hospitalName: dto.hospitalName ?? hospital.hospitalName,
            address: dto.address ?? hospital.address,
            city: dto.city ?? hospital.city,
            region: dto.region ?? hospital.region,
            location: dto.location ?? hospital.location,
          });

    const resolvedLatitude = dto.latitude ?? geocoded?.latitude ?? hospital.latitude;
    const resolvedLongitude = dto.longitude ?? geocoded?.longitude ?? hospital.longitude;
    const resolvedCity = typeof dto.city === 'string' ? dto.city.trim() : hospital.city;
    const resolvedRegion = typeof dto.region === 'string' ? dto.region.trim() : hospital.region;
    this.validateCompleteMapLocation({
      city: resolvedCity,
      region: resolvedRegion,
      latitude: resolvedLatitude,
      longitude: resolvedLongitude,
    });
    if (resolvedLatitude === null || resolvedLongitude === null) {
      throw new BadRequestException(
        'Unable to locate this hospital automatically. Please enter latitude and longitude manually.',
      );
    }

    const updated = await this.prisma.hospital.update({
      where: { id: hospitalId },
      data: {
        ...dto,
        city: resolvedCity,
        region: resolvedRegion,
        latitude: resolvedLatitude,
        longitude: resolvedLongitude,
      },
      include: {
        user: { select: { id: true, email: true, role: true, isActive: true } },
      },
    });

    await this.audit.log('HOSPITAL_UPDATED_BY_ADMIN', 'HOSPITAL', actorUserId, hospitalId, dto);
    this.realtime.broadcastHospitalMapUpdate({
      reason: updated.isApproved && !hospital.isApproved ? 'hospital.approved' : 'hospital.updated',
      hospitalId: updated.id,
      hospitalName: updated.hospitalName,
      latitude: updated.latitude,
      longitude: updated.longitude,
      isApproved: updated.isApproved,
    });
    return updated;
  }

  async removeByAdmin(hospitalId: string, actorUserId: string) {
    const hospital = await this.prisma.hospital.findUnique({ where: { id: hospitalId }, include: { user: true } });
    if (!hospital) {
      throw new NotFoundException('Hospital not found');
    }

    await this.prisma.user.delete({ where: { id: hospital.userId } });
    await this.audit.log('HOSPITAL_DELETED_BY_ADMIN', 'HOSPITAL', actorUserId, hospitalId, {
      email: hospital.user.email,
    });

    return { message: 'Hospital deleted successfully' };
  }

  async getEligibilitySubmissions(userId: string) {
    const hospital = await this.getHospitalByUser(userId);

    const submissionLogs = await this.prisma.auditLog.findMany({
      where: { action: 'DONOR_HEALTH_FORM_SUBMITTED', entityType: 'DONOR' },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const officeUseLogs = await this.prisma.auditLog.findMany({
      where: { action: 'HOSPITAL_OFFICE_USE_SUBMITTED', entityType: 'DONOR' },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const officeUseByDonor = new Map<string, any>();
    for (const entry of officeUseLogs) {
      const md = (entry.metadata as any) ?? {};
      if (md?.hospitalId !== hospital.id) continue;
      const donorId = entry.entityId ?? md?.donorId;
      if (donorId && !officeUseByDonor.has(donorId)) {
        officeUseByDonor.set(donorId, { createdAt: entry.createdAt, officeUseOnly: md?.officeUseOnly ?? null });
      }
    }

    const selectedForHospital = submissionLogs.filter((log) => {
      const md = (log.metadata as any) ?? {};
      return md?.selectedHospitalId === hospital.id;
    });

    const donorIds = [...new Set(selectedForHospital.map((log) => log.entityId).filter(Boolean))] as string[];
    const donors = donorIds.length
      ? await this.prisma.donor.findMany({ where: { id: { in: donorIds } }, include: { user: { select: { email: true } } } })
      : [];
    const donorMap = new Map(donors.map((d) => [d.id, d]));

    return selectedForHospital.map((log) => {
      const md = (log.metadata as any) ?? {};
      const donorId = log.entityId ?? '';
      const donor = donorMap.get(donorId);
      return {
        donorId,
        submittedAt: log.createdAt,
        selectedHospitalId: md?.selectedHospitalId,
        donorForm: {
          personalInformation: md?.personalInformation ?? {},
          donationHistory: md?.donationHistory ?? {},
          replacementFamilyDonor: md?.replacementFamilyDonor ?? {},
          healthQuestionnaire: md?.healthQuestionnaire ?? {},
          donorDeclarationAccepted: md?.donorDeclarationAccepted ?? false,
        },
        donor: donor
          ? {
              fullName: donor.fullName,
              bloodGroup: donor.bloodGroup,
              location: donor.location,
              email: donor.user.email,
              eligibilityStatus: donor.eligibilityStatus,
              availabilityStatus: donor.availabilityStatus,
            }
          : null,
        officeUse: officeUseByDonor.get(donorId) ?? null,
      };
    });
  }

  async submitOfficeUse(userId: string, donorId: string, officeUseOnly: SubmitOfficeUseDto['officeUseOnly']) {
    const hospital = await this.getHospitalByUser(userId);
    const donor = await this.prisma.donor.findUnique({ where: { id: donorId } });
    if (!donor) {
      throw new NotFoundException('Donor not found');
    }

    const donorSubmission = await this.prisma.auditLog.findFirst({
      where: { action: 'DONOR_HEALTH_FORM_SUBMITTED', entityType: 'DONOR', entityId: donorId },
      orderBy: { createdAt: 'desc' },
    });
    if (!donorSubmission) {
      throw new BadRequestException('No donor form submission found.');
    }

    const submissionMd = (donorSubmission.metadata as any) ?? {};
    if (submissionMd?.selectedHospitalId !== hospital.id) {
      throw new BadRequestException('This donor did not submit to your hospital.');
    }

    await this.audit.log('HOSPITAL_OFFICE_USE_SUBMITTED', 'DONOR', userId, donorId, {
      hospitalId: hospital.id,
      officeUseOnly,
    });

    return { message: 'Office-use section saved for donor.' };
  }

  async approveEligibility(userId: string, donorId: string, approved: ApproveDonorEligibilityDto['approved']) {
    const hospital = await this.getHospitalByUser(userId);
    const donor = await this.prisma.donor.findUnique({ where: { id: donorId } });
    if (!donor) {
      throw new NotFoundException('Donor not found');
    }

    const donorSubmission = await this.prisma.auditLog.findFirst({
      where: { action: 'DONOR_HEALTH_FORM_SUBMITTED', entityType: 'DONOR', entityId: donorId },
      orderBy: { createdAt: 'desc' },
    });
    if (!donorSubmission) {
      throw new BadRequestException('No donor form submission found.');
    }

    const submissionMd = (donorSubmission.metadata as any) ?? {};
    if (submissionMd?.selectedHospitalId !== hospital.id) {
      throw new BadRequestException('This donor did not submit to your hospital.');
    }

    const officeUse = await this.prisma.auditLog.findFirst({
      where: { action: 'HOSPITAL_OFFICE_USE_SUBMITTED', entityType: 'DONOR', entityId: donorId },
      orderBy: { createdAt: 'desc' },
    });

    const officeUseMd = (officeUse?.metadata as any) ?? {};
    if (!officeUse || officeUseMd?.hospitalId !== hospital.id) {
      throw new BadRequestException('Hospital must complete Office Use Only form before approval.');
    }

    const updated = await this.prisma.donor.update({
      where: { id: donorId },
      data: {
        eligibilityStatus: approved,
        availabilityStatus: approved ? donor.availabilityStatus : false,
      },
    });

    await this.audit.log('HOSPITAL_DONOR_ELIGIBILITY_DECISION', 'DONOR', userId, donorId, {
      hospitalId: hospital.id,
      approved,
    });
    this.realtime.broadcastDonorSearchInvalidated({
      donorId: updated.id,
      bloodGroup: updated.bloodGroup,
      preferredHospitalId: updated.preferredHospitalId,
      reason: 'hospital.donor-eligibility.updated',
    });

    return updated;
  }

  private async getHospitalByUser(userId: string) {
    return this.hospitalAccess.getHospitalForUser(userId);
  }
}
