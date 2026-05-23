import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BloodGroup, PriorityLevel, RequestStatus, Role } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { RealtimeService } from '../../common/realtime/realtime.service';
import { HospitalAccessService } from '../../common/rbac/hospital-access.service';
import { NearbyDonorQueryDto } from './dto/nearby-donor-query.dto';
import { UpdateDonorLocationDto } from './dto/update-donor-location.dto';
import { OperationalDonorQueryDto } from './dto/operational-donor-query.dto';
import { BloodBankQueryDto, NearestBloodSourceQueryDto } from './dto/blood-bank-query.dto';
import {
  SmartBloodAvailability,
  SmartBloodBankCenter,
  SmartBloodBankMapResponse,
  SmartEmergencyRequest,
} from './smart-blood-banks.types';

const LOCATION_VIEW_ROLES = new Set<Role>([
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.HOSPITAL_ADMIN,
  Role.HOSPITAL_STAFF,
  Role.DONOR_REVIEW_OFFICER,
]);

const BLOOD_GROUPS: BloodGroup[] = [
  BloodGroup.O_POS,
  BloodGroup.O_NEG,
  BloodGroup.A_POS,
  BloodGroup.A_NEG,
  BloodGroup.B_POS,
  BloodGroup.B_NEG,
  BloodGroup.AB_POS,
  BloodGroup.AB_NEG,
];

const BLOOD_GROUP_LABELS: Record<BloodGroup, string> = {
  O_POS: 'O+',
  O_NEG: 'O-',
  A_POS: 'A+',
  A_NEG: 'A-',
  B_POS: 'B+',
  B_NEG: 'B-',
  AB_POS: 'AB+',
  AB_NEG: 'AB-',
};

@Injectable()
export class MapsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeService,
    private readonly hospitalAccess: HospitalAccessService,
  ) {}

  private compatibleDonorGroups(requested: BloodGroup): BloodGroup[] {
    const compatibility: Record<BloodGroup, BloodGroup[]> = {
      O_NEG: ['O_NEG'],
      O_POS: ['O_POS', 'O_NEG'],
      A_NEG: ['A_NEG', 'O_NEG'],
      A_POS: ['A_POS', 'A_NEG', 'O_POS', 'O_NEG'],
      B_NEG: ['B_NEG', 'O_NEG'],
      B_POS: ['B_POS', 'B_NEG', 'O_POS', 'O_NEG'],
      AB_NEG: ['AB_NEG', 'A_NEG', 'B_NEG', 'O_NEG'],
      AB_POS: ['AB_POS', 'AB_NEG', 'A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'O_POS', 'O_NEG'],
    };
    return compatibility[requested];
  }

  private distanceKm(fromLat: number, fromLng: number, toLat: number, toLng: number) {
    const earthRadiusKm = 6371;
    const dLat = this.toRad(toLat - fromLat);
    const dLng = this.toRad(toLng - fromLng);
    const lat1 = this.toRad(fromLat);
    const lat2 = this.toRad(toLat);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRad(value: number) {
    return (value * Math.PI) / 180;
  }

  private labelBloodGroup(group: BloodGroup) {
    return BLOOD_GROUP_LABELS[group] ?? group;
  }

  private stockStatus(availableUnits: number, lowThreshold = 7, criticalThreshold = 3): SmartBloodAvailability['status'] {
    if (availableUnits <= criticalThreshold) return 'critical';
    if (availableUnits <= lowThreshold) return 'low';
    return 'stable';
  }

  private inferCenterType(name: string, description?: string | null): SmartBloodBankCenter['centerType'] {
    const value = `${name} ${description ?? ''}`.toLowerCase();
    if (value.includes('blood bank') || value.includes('blood service')) return 'blood_bank';
    if (value.includes('donation') || value.includes('donor')) return 'donation_center';
    return 'hospital';
  }

  private inferRegionAndCity(location: string) {
    const parts = location.split(',').map((part) => part.trim()).filter(Boolean);
    return {
      city: parts[0] ?? location,
      region: parts[1] ?? parts[0] ?? 'Ghana',
    };
  }

  private emergencyLevelFrom(priority?: PriorityLevel | null, criticalStockCount = 0, lowStockCount = 0): SmartBloodBankCenter['emergencyLevel'] {
    if (priority === PriorityLevel.CRITICAL || criticalStockCount > 0) return 'critical';
    if (priority === PriorityLevel.HIGH || lowStockCount > 1) return 'urgent';
    if (lowStockCount > 0) return 'watch';
    return 'normal';
  }

  private distanceOrNull(originLat?: number, originLng?: number, latitude?: number | null, longitude?: number | null) {
    if (typeof originLat !== 'number' || typeof originLng !== 'number' || typeof latitude !== 'number' || typeof longitude !== 'number') {
      return null;
    }

    return Number(this.distanceKm(originLat, originLng, latitude, longitude).toFixed(2));
  }

  private normalizeSearch(value?: string) {
    const normalized = value?.trim().toLowerCase();
    return normalized && normalized.length > 0 ? normalized : null;
  }

  private assertCanViewLiveLocations(role: Role) {
    if (!LOCATION_VIEW_ROLES.has(role)) {
      throw new ForbiddenException('Live donor locations are restricted to authorized admin and hospital staff.');
    }
  }

  async getSmartBloodBankMap(query: BloodBankQueryDto): Promise<SmartBloodBankMapResponse> {
    const search = this.normalizeSearch(query.search);
    const radiusKm = query.radiusKm ?? null;
    const hasOrigin = typeof query.latitude === 'number' && typeof query.longitude === 'number';

    const [hospitals, partnerHospitals, activeRequests, eligibleDonors] = await Promise.all([
      this.prisma.hospital.findMany({
        where: {
          isApproved: true,
          latitude: { not: null },
          longitude: { not: null },
        },
        include: {
          user: { select: { email: true } },
          inventoryItems: true,
          bloodRequests: {
            where: { status: { in: [RequestStatus.OPEN, RequestStatus.MATCHING] } },
            select: { id: true, priority: true, bloodGroup: true, unitsNeeded: true },
          },
        },
        orderBy: { hospitalName: 'asc' },
      }),
      this.prisma.partnerHospital.findMany({
        where: {
          latitude: { not: null },
          longitude: { not: null },
        },
        orderBy: { hospitalName: 'asc' },
      }),
      this.prisma.bloodRequest.findMany({
        where: {
          status: { in: [RequestStatus.OPEN, RequestStatus.MATCHING] },
          latitude: { not: null },
          longitude: { not: null },
        },
        select: {
          id: true,
          hospitalId: true,
          bloodGroup: true,
          unitsNeeded: true,
          priority: true,
          status: true,
          trackingStatus: true,
          location: true,
          emergencyLocation: true,
          city: true,
          region: true,
          ward: true,
          locationNotes: true,
          notes: true,
          hospitalCenterName: true,
          latitude: true,
          longitude: true,
          createdAt: true,
          requiredBy: true,
          hospital: { select: { hospitalName: true } },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        take: 100,
      }),
      this.prisma.donor.findMany({
        where: {
          eligibilityStatus: true,
          availabilityStatus: true,
          locationSharingEnabled: true,
          latitude: { not: null },
          longitude: { not: null },
        },
        select: {
          id: true,
          bloodGroup: true,
          latitude: true,
          longitude: true,
        },
        take: 1200,
      }),
    ]);

    const hospitalNames = new Set(hospitals.map((hospital) => hospital.hospitalName.toLowerCase()));

    const hospitalCenters: SmartBloodBankCenter[] = hospitals.map((hospital) => {
      const inventoryByGroup = new Map(hospital.inventoryItems.map((item) => [item.bloodGroup, item]));
      const bloodAvailability = BLOOD_GROUPS.map((bloodGroup) => {
        const item = inventoryByGroup.get(bloodGroup);
        const availableUnits = item?.availableUnits ?? 0;
        return {
          bloodGroup,
          label: this.labelBloodGroup(bloodGroup),
          availableUnits,
          expiringUnits: item?.expiringUnits ?? 0,
          status: this.stockStatus(availableUnits, item?.lowThreshold, item?.criticalThreshold),
        };
      });

      const lowStockCount = bloodAvailability.filter((item) => item.status === 'low').length;
      const criticalStockCount = bloodAvailability.filter((item) => item.status === 'critical').length;
      const highestPriority = hospital.bloodRequests.some((request) => request.priority === PriorityLevel.CRITICAL)
        ? PriorityLevel.CRITICAL
        : hospital.bloodRequests.some((request) => request.priority === PriorityLevel.HIGH)
          ? PriorityLevel.HIGH
          : null;
      const { city, region } = this.inferRegionAndCity(hospital.location);

      return {
        id: hospital.id,
        source: 'hospital',
        name: hospital.hospitalName,
        centerType: this.inferCenterType(hospital.hospitalName),
        region,
        city,
        address: hospital.address,
        contactPhone: hospital.contactPhone,
        email: hospital.user?.email ?? null,
        description: `${hospital.hospitalName} inventory is connected to the emergency response network.`,
        latitude: hospital.latitude ?? 0,
        longitude: hospital.longitude ?? 0,
        distanceKm: this.distanceOrNull(query.latitude, query.longitude, hospital.latitude, hospital.longitude),
        operatingStatus: 'open_24_7',
        emergencyLevel: this.emergencyLevelFrom(highestPriority, criticalStockCount, lowStockCount),
        totalUnits: bloodAvailability.reduce((total, item) => total + item.availableUnits, 0),
        lowStockCount,
        criticalStockCount,
        availableBloodGroups: bloodAvailability.filter((item) => item.availableUnits > 0).map((item) => item.label),
        bloodAvailability,
        activeEmergencyRequests: hospital.bloodRequests.length,
        lastUpdated:
          hospital.inventoryItems
            .map((item) => item.lastUpdated)
            .sort((a, b) => b.getTime() - a.getTime())[0]
            ?.toISOString() ?? null,
      };
    });

    const partnerCenters: SmartBloodBankCenter[] = partnerHospitals
      .filter((center) => !hospitalNames.has(center.hospitalName.toLowerCase()))
      .map((center) => {
        const { city, region } = this.inferRegionAndCity(center.location);
        const bloodAvailability = BLOOD_GROUPS.map((bloodGroup) => ({
          bloodGroup,
          label: this.labelBloodGroup(bloodGroup),
          availableUnits: 0,
          expiringUnits: 0,
          status: 'unpublished' as const,
        }));

        return {
          id: center.id,
          source: 'partner_hospital',
          name: center.hospitalName,
          centerType: this.inferCenterType(center.hospitalName, center.description),
          region,
          city,
          address: center.location,
          contactPhone: center.phone,
          email: center.email,
          description: center.description,
          latitude: center.latitude ?? 0,
          longitude: center.longitude ?? 0,
          distanceKm: this.distanceOrNull(query.latitude, query.longitude, center.latitude, center.longitude),
          operatingStatus: 'open',
          emergencyLevel: 'normal',
          totalUnits: 0,
          lowStockCount: 0,
          criticalStockCount: 0,
          availableBloodGroups: [],
          bloodAvailability,
          activeEmergencyRequests: 0,
          lastUpdated: null,
        };
      });

    const emergencyRequests: SmartEmergencyRequest[] = activeRequests.map((request) => ({
      id: request.id,
      hospitalId: request.hospitalId,
      hospitalName: request.hospital.hospitalName,
      hospitalCenterName: request.hospitalCenterName ?? null,
      ward: request.ward ?? null,
      bloodGroup: request.bloodGroup,
      bloodGroupLabel: this.labelBloodGroup(request.bloodGroup),
      unitsNeeded: request.unitsNeeded,
      priority: request.priority,
      status: request.status,
      trackingStatus: request.trackingStatus,
      location: request.location,
      emergencyLocation: request.emergencyLocation ?? null,
      city: request.city ?? null,
      region: request.region ?? null,
      locationNotes: request.locationNotes ?? null,
      notes: request.notes ?? null,
      latitude: request.latitude ?? 0,
      longitude: request.longitude ?? 0,
      createdAt: request.createdAt.toISOString(),
      requiredBy: request.requiredBy.toISOString(),
      distanceKm: this.distanceOrNull(query.latitude, query.longitude, request.latitude, request.longitude),
      nearby: {
        radius5km: {
          compatibleDonors: eligibleDonors.filter(
            (donor) =>
              this.compatibleDonorGroups(request.bloodGroup).includes(donor.bloodGroup) &&
              this.distanceKm(request.latitude ?? 0, request.longitude ?? 0, donor.latitude ?? 0, donor.longitude ?? 0) <= 5,
          ).length,
          bloodBanks: [...hospitalCenters, ...partnerCenters].filter(
            (center) =>
              center.centerType === 'blood_bank' &&
              this.distanceKm(request.latitude ?? 0, request.longitude ?? 0, center.latitude, center.longitude) <= 5,
          ).length,
          hospitalsWithStock: hospitalCenters.filter(
            (center) =>
              center.availableBloodGroups.includes(this.labelBloodGroup(request.bloodGroup)) &&
              this.distanceKm(request.latitude ?? 0, request.longitude ?? 0, center.latitude, center.longitude) <= 5,
          ).length,
        },
        radius10km: {
          compatibleDonors: eligibleDonors.filter(
            (donor) =>
              this.compatibleDonorGroups(request.bloodGroup).includes(donor.bloodGroup) &&
              this.distanceKm(request.latitude ?? 0, request.longitude ?? 0, donor.latitude ?? 0, donor.longitude ?? 0) <= 10,
          ).length,
          bloodBanks: [...hospitalCenters, ...partnerCenters].filter(
            (center) =>
              center.centerType === 'blood_bank' &&
              this.distanceKm(request.latitude ?? 0, request.longitude ?? 0, center.latitude, center.longitude) <= 10,
          ).length,
          hospitalsWithStock: hospitalCenters.filter(
            (center) =>
              center.availableBloodGroups.includes(this.labelBloodGroup(request.bloodGroup)) &&
              this.distanceKm(request.latitude ?? 0, request.longitude ?? 0, center.latitude, center.longitude) <= 10,
          ).length,
        },
        radius20km: {
          compatibleDonors: eligibleDonors.filter(
            (donor) =>
              this.compatibleDonorGroups(request.bloodGroup).includes(donor.bloodGroup) &&
              this.distanceKm(request.latitude ?? 0, request.longitude ?? 0, donor.latitude ?? 0, donor.longitude ?? 0) <= 20,
          ).length,
          bloodBanks: [...hospitalCenters, ...partnerCenters].filter(
            (center) =>
              center.centerType === 'blood_bank' &&
              this.distanceKm(request.latitude ?? 0, request.longitude ?? 0, center.latitude, center.longitude) <= 20,
          ).length,
          hospitalsWithStock: hospitalCenters.filter(
            (center) =>
              center.availableBloodGroups.includes(this.labelBloodGroup(request.bloodGroup)) &&
              this.distanceKm(request.latitude ?? 0, request.longitude ?? 0, center.latitude, center.longitude) <= 20,
          ).length,
        },
      },
    }));

    const matchingText = (center: SmartBloodBankCenter) =>
      [center.name, center.centerType, center.region, center.city, center.address, center.contactPhone, center.email, center.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    const centers = [...hospitalCenters, ...partnerCenters]
      .filter((center) => (search ? matchingText(center).includes(search) : true))
      .filter((center) =>
        query.bloodGroup
          ? center.bloodAvailability.some((item) => item.bloodGroup === query.bloodGroup && item.availableUnits > 0)
          : true,
      )
      .filter((center) => (hasOrigin && radiusKm ? (center.distanceKm ?? Number.POSITIVE_INFINITY) <= radiusKm : true))
      .filter((center) => (query.emergencyMode ? center.emergencyLevel !== 'normal' || center.activeEmergencyRequests > 0 : true))
      .sort((a, b) => {
        if (a.emergencyLevel !== b.emergencyLevel) {
          const rank = { critical: 0, urgent: 1, watch: 2, normal: 3 };
          return rank[a.emergencyLevel] - rank[b.emergencyLevel];
        }
        if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
        return b.totalUnits - a.totalUnits;
      });

    const requests = emergencyRequests
      .filter((request) => (query.bloodGroup ? request.bloodGroup === query.bloodGroup : true))
      .filter((request) => (hasOrigin && radiusKm ? (request.distanceKm ?? Number.POSITIVE_INFINITY) <= radiusKm : true));

    const nearestCenter = centers.find((center) => center.distanceKm !== null) ?? centers[0] ?? null;
    const nearestMatchingSource =
      centers.find((center) =>
        query.bloodGroup
          ? center.bloodAvailability.some((item) => item.bloodGroup === query.bloodGroup && item.availableUnits > 0)
          : center.totalUnits > 0,
      ) ?? null;

    return {
      centers,
      emergencyRequests: requests,
      summary: {
        totalCenters: centers.length,
        centersWithPublishedInventory: centers.filter((center) => center.source === 'hospital').length,
        totalUnitsAvailable: centers.reduce((total, center) => total + center.totalUnits, 0),
        lowStockCenters: centers.filter((center) => center.lowStockCount > 0).length,
        criticalStockCenters: centers.filter((center) => center.criticalStockCount > 0).length,
        activeEmergencyRequests: requests.length,
        nearestCenter,
        nearestMatchingSource,
      },
      filters: {
        search,
        bloodGroup: query.bloodGroup ?? null,
        radiusKm,
        latitude: query.latitude ?? null,
        longitude: query.longitude ?? null,
        emergencyMode: Boolean(query.emergencyMode),
      },
    };
  }

  async getNearestBloodSource(query: NearestBloodSourceQueryDto) {
    const results = await this.getSmartBloodBankMap({
      bloodGroup: query.bloodGroup,
      latitude: query.latitude,
      longitude: query.longitude,
      radiusKm: query.radiusKm ?? 20,
    });

    return {
      bloodGroup: query.bloodGroup,
      bloodGroupLabel: this.labelBloodGroup(query.bloodGroup),
      radiusKm: query.radiusKm ?? 20,
      nearest: results.summary.nearestMatchingSource,
    };
  }

  async updateOwnDonorLocation(userId: string, dto: UpdateDonorLocationDto, ipAddress?: string, device?: string) {
    const donor = await this.prisma.donor.findUnique({
      where: { userId },
      select: {
        id: true,
        fullName: true,
        latitude: true,
        longitude: true,
        locationSharingEnabled: true,
      },
    });
    if (!donor) {
      throw new NotFoundException('Donor profile not found');
    }

    const wantsSharingDisabled = dto.locationSharingEnabled === false;
    const hasCoordinates = typeof dto.latitude === 'number' && typeof dto.longitude === 'number';
    const hasExistingCoordinates = typeof donor.latitude === 'number' && typeof donor.longitude === 'number';

    if (!wantsSharingDisabled && !hasCoordinates && !hasExistingCoordinates) {
      throw new BadRequestException('Latitude and longitude are required before enabling donor location sharing.');
    }

    const locationParts = [dto.areaCommunity, dto.city, dto.region].filter(Boolean).join(', ');
    const updated = await this.prisma.donor.update({
      where: { userId },
      data: {
        ...(hasCoordinates ? { latitude: dto.latitude, longitude: dto.longitude, lastLocationUpdateAt: new Date() } : {}),
        ...(typeof dto.areaCommunity === 'string' ? { areaCommunity: dto.areaCommunity.trim() || null } : {}),
        ...(typeof dto.city === 'string' ? { city: dto.city.trim() || null } : {}),
        ...(typeof dto.region === 'string' ? { region: dto.region.trim() || null } : {}),
        ...(locationParts ? { location: locationParts } : {}),
        locationSharingEnabled: dto.locationSharingEnabled ?? donor.locationSharingEnabled,
      },
      select: {
        id: true,
        bloodGroup: true,
        location: true,
        areaCommunity: true,
        city: true,
        region: true,
        latitude: true,
        longitude: true,
        locationSharingEnabled: true,
        lastLocationUpdateAt: true,
        availabilityStatus: true,
        eligibilityStatus: true,
        updatedAt: true,
      },
    });

    await this.audit.log('DONOR_LOCATION_UPDATED', 'DONOR_LOCATION', userId, donor.id, {
      accuracyMeters: dto.accuracyMeters ?? null,
      source: dto.source ?? 'browser_geolocation',
      locationSharingEnabled: updated.locationSharingEnabled,
    }, `${donor.fullName} updated live donor location.`, { module: 'MAP_TRACKING', ipAddress, device });

    if (updated.locationSharingEnabled && hasCoordinates) {
      this.realtime.broadcastDonorLocation({
        donorId: updated.id,
        latitude: updated.latitude,
        longitude: updated.longitude,
        updatedAt: updated.lastLocationUpdateAt ?? updated.updatedAt,
      });
    }

    return { message: 'Location updated securely.', donor: updated };
  }

  async findNearbyEligibleDonors(userId: string, role: Role, query: NearbyDonorQueryDto, ipAddress?: string, device?: string) {
    this.assertCanViewLiveLocations(role);
    const radiusKm = query.radiusKm ?? 25;
    const compatibleGroups = this.compatibleDonorGroups(query.bloodGroup);

    const candidates = await this.prisma.donor.findMany({
      where: {
        bloodGroup: { in: compatibleGroups },
        eligibilityStatus: true,
        availabilityStatus: true,
        locationSharingEnabled: true,
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        bloodGroup: true,
        location: true,
        areaCommunity: true,
        city: true,
        region: true,
        locationSharingEnabled: true,
        lastLocationUpdateAt: true,
        latitude: true,
        longitude: true,
        updatedAt: true,
      },
      take: 500,
    });

    const donors = candidates
      .map((donor) => ({
        ...donor,
        distanceKm: Number(this.distanceKm(query.latitude, query.longitude, donor.latitude ?? 0, donor.longitude ?? 0).toFixed(2)),
      }))
      .filter((donor) => donor.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    await this.audit.log('NEARBY_DONORS_ACCESSED', 'DONOR_LOCATION', userId, undefined, {
      bloodGroup: query.bloodGroup,
      radiusKm,
      resultCount: donors.length,
    }, 'Authorized user searched nearby donor live locations.', { module: 'MAP_TRACKING', ipAddress, device });

    return donors;
  }

  async getOperationalDonors(userId: string, role: Role, query: OperationalDonorQueryDto, ipAddress?: string, device?: string) {
    this.assertCanViewLiveLocations(role);
    const radiusKm = query.radiusKm ?? 25;
    const canCalculateDistance = typeof query.latitude === 'number' && typeof query.longitude === 'number';

    const donors = await this.prisma.donor.findMany({
      where: {
        ...(query.bloodGroup ? { bloodGroup: query.bloodGroup } : {}),
        eligibilityStatus: true,
        availabilityStatus: true,
        locationSharingEnabled: true,
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        bloodGroup: true,
        location: true,
        areaCommunity: true,
        city: true,
        region: true,
        latitude: true,
        longitude: true,
        locationSharingEnabled: true,
        lastLocationUpdateAt: true,
        updatedAt: true,
      },
      orderBy: { lastLocationUpdateAt: 'desc' },
      take: 500,
    });

    const filtered = donors
      .map((donor) => ({
        ...donor,
        distanceKm: canCalculateDistance
          ? Number(this.distanceKm(query.latitude!, query.longitude!, donor.latitude ?? 0, donor.longitude ?? 0).toFixed(2))
          : undefined,
      }))
      .filter((donor) => (canCalculateDistance ? (donor.distanceKm ?? Number.POSITIVE_INFINITY) <= radiusKm : true))
      .sort((a, b) => (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY));

    await this.audit.log('OPERATIONAL_DONORS_ACCESSED', 'DONOR_LOCATION', userId, undefined, {
      bloodGroup: query.bloodGroup ?? null,
      radiusKm: canCalculateDistance ? radiusKm : null,
      resultCount: filtered.length,
    }, 'Authorized user viewed operational donor map data.', { module: 'MAP_TRACKING', ipAddress, device });

    return filtered;
  }

  async getDonorCoverage(userId: string, role: Role, ipAddress?: string, device?: string) {
    this.assertCanViewLiveLocations(role);

    const donors = await this.prisma.donor.findMany({
      where: {
        eligibilityStatus: true,
        availabilityStatus: true,
        locationSharingEnabled: true,
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        bloodGroup: true,
        city: true,
        region: true,
        areaCommunity: true,
      },
      take: 2000,
    });

    const regions = new Map<string, { region: string; donorCount: number; cities: Set<string>; bloodGroups: Partial<Record<BloodGroup, number>> }>();
    const cities = new Map<string, { city: string; region: string; donorCount: number; bloodGroups: Partial<Record<BloodGroup, number>> }>();

    donors.forEach((donor) => {
      const region = donor.region ?? 'Unspecified region';
      const city = donor.city ?? donor.areaCommunity ?? 'Unspecified city';
      const regionRecord = regions.get(region) ?? { region, donorCount: 0, cities: new Set<string>(), bloodGroups: {} };
      regionRecord.donorCount += 1;
      regionRecord.cities.add(city);
      regionRecord.bloodGroups[donor.bloodGroup] = (regionRecord.bloodGroups[donor.bloodGroup] ?? 0) + 1;
      regions.set(region, regionRecord);

      const cityKey = `${region}:${city}`;
      const cityRecord = cities.get(cityKey) ?? { city, region, donorCount: 0, bloodGroups: {} };
      cityRecord.donorCount += 1;
      cityRecord.bloodGroups[donor.bloodGroup] = (cityRecord.bloodGroups[donor.bloodGroup] ?? 0) + 1;
      cities.set(cityKey, cityRecord);
    });

    await this.audit.log('DONOR_COVERAGE_VIEWED', 'DONOR_LOCATION', userId, undefined, {
      donorCount: donors.length,
      regionCount: regions.size,
    }, 'Authorized user viewed donor coverage statistics.', { module: 'MAP_TRACKING', ipAddress, device });

    return {
      totalVisibleDonors: donors.length,
      regions: Array.from(regions.values())
        .map((record) => ({
          region: record.region,
          donorCount: record.donorCount,
          cityCount: record.cities.size,
          bloodGroups: record.bloodGroups,
        }))
        .sort((a, b) => b.donorCount - a.donorCount),
      cities: Array.from(cities.values()).sort((a, b) => b.donorCount - a.donorCount),
    };
  }

  async getOperationsMap(userId: string, role: Role, ipAddress?: string, device?: string) {
    this.assertCanViewLiveLocations(role);

    const hospitalScope =
      role === Role.HOSPITAL_ADMIN || role === Role.HOSPITAL_STAFF || role === Role.DONOR_REVIEW_OFFICER
        ? await this.hospitalAccess.getHospitalForUser(userId)
        : null;

    const [hospitals, requests, donors] = await Promise.all([
      this.prisma.hospital.findMany({
        where: hospitalScope ? { id: hospitalScope.id } : { latitude: { not: null }, longitude: { not: null } },
        select: { id: true, hospitalName: true, location: true, address: true, latitude: true, longitude: true, contactPhone: true },
        orderBy: { hospitalName: 'asc' },
      }),
      this.prisma.bloodRequest.findMany({
        where: {
          ...(hospitalScope ? { hospitalId: hospitalScope.id } : {}),
          latitude: { not: null },
          longitude: { not: null },
          status: { in: [RequestStatus.OPEN, RequestStatus.MATCHING] },
        },
        select: {
          id: true,
          bloodGroup: true,
          unitsNeeded: true,
          priority: true,
          status: true,
          trackingStatus: true,
          hospitalCenterName: true,
          ward: true,
          location: true,
          emergencyLocation: true,
          city: true,
          region: true,
          locationNotes: true,
          notes: true,
          latitude: true,
          longitude: true,
          createdAt: true,
          requiredBy: true,
          hospital: { select: { id: true, hospitalName: true } },
          donorResponses: { select: { responseStatus: true } },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        take: 100,
      }),
      this.prisma.donor.findMany({
        where: {
          latitude: { not: null },
          longitude: { not: null },
          eligibilityStatus: true,
          availabilityStatus: true,
          locationSharingEnabled: true,
        },
        select: {
          id: true,
          bloodGroup: true,
          location: true,
          areaCommunity: true,
          city: true,
          region: true,
          latitude: true,
          longitude: true,
          locationSharingEnabled: true,
          lastLocationUpdateAt: true,
          updatedAt: true,
        },
        orderBy: { lastLocationUpdateAt: 'desc' },
        take: 250,
      }),
    ]);

    await this.audit.log('OPERATIONS_MAP_VIEWED', 'DONOR_LOCATION', userId, undefined, {
      hospitalScopeId: hospitalScope?.id ?? null,
      donorCount: donors.length,
      requestCount: requests.length,
    }, 'Authorized user opened the live operations map.', { module: 'MAP_TRACKING', ipAddress, device });

    return { hospitals, requests, donors };
  }
}
