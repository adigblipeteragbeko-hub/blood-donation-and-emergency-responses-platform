import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BloodGroup, PriorityLevel, RequestStatus, Role } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { RealtimeService } from '../../common/realtime/realtime.service';
import { HospitalAccessService } from '../../common/rbac/hospital-access.service';
import { NearbyDonorQueryDto } from './dto/nearby-donor-query.dto';
import { UpdateDonorLocationDto } from './dto/update-donor-location.dto';
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

    const [hospitals, partnerHospitals, activeRequests] = await Promise.all([
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
          location: true,
          latitude: true,
          longitude: true,
          createdAt: true,
          requiredBy: true,
          hospital: { select: { hospitalName: true } },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        take: 100,
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
      bloodGroup: request.bloodGroup,
      bloodGroupLabel: this.labelBloodGroup(request.bloodGroup),
      unitsNeeded: request.unitsNeeded,
      priority: request.priority,
      status: request.status,
      location: request.location,
      latitude: request.latitude ?? 0,
      longitude: request.longitude ?? 0,
      createdAt: request.createdAt.toISOString(),
      requiredBy: request.requiredBy.toISOString(),
      distanceKm: this.distanceOrNull(query.latitude, query.longitude, request.latitude, request.longitude),
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
    const donor = await this.prisma.donor.findUnique({ where: { userId }, select: { id: true, fullName: true } });
    if (!donor) {
      throw new NotFoundException('Donor profile not found');
    }

    const updated = await this.prisma.donor.update({
      where: { userId },
      data: {
        latitude: dto.latitude,
        longitude: dto.longitude,
      },
      select: {
        id: true,
        fullName: true,
        bloodGroup: true,
        location: true,
        latitude: true,
        longitude: true,
        availabilityStatus: true,
        eligibilityStatus: true,
        updatedAt: true,
      },
    });

    await this.audit.log('DONOR_LOCATION_UPDATED', 'DONOR_LOCATION', userId, donor.id, {
      accuracyMeters: dto.accuracyMeters ?? null,
      source: dto.source ?? 'browser_geolocation',
    }, `${donor.fullName} updated live donor location.`, { module: 'MAP_TRACKING', ipAddress, device });

    this.realtime.broadcastDonorLocation({
      donorId: updated.id,
      latitude: updated.latitude,
      longitude: updated.longitude,
      updatedAt: updated.updatedAt,
    });

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
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        fullName: true,
        bloodGroup: true,
        location: true,
        latitude: true,
        longitude: true,
        updatedAt: true,
      },
      take: 500,
    });

    const donors = candidates
      .map((donor) => ({
        ...donor,
        distanceKm: this.distanceKm(query.latitude, query.longitude, donor.latitude ?? 0, donor.longitude ?? 0),
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
          location: true,
          latitude: true,
          longitude: true,
          createdAt: true,
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
        },
        select: { id: true, fullName: true, bloodGroup: true, location: true, latitude: true, longitude: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
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
