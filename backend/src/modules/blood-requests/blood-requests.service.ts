import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BloodGroup,
  DonorClinicalStatus,
  DonorResponseStatus,
  HospitalBloodTransferStatus,
  HospitalRequestResponseStatus,
  HospitalRequestResponseType,
  InventoryChangeType,
  NotificationType,
  Prisma,
  RequestSource,
  RequestProgressStatus,
  RequestStatus,
  Role,
} from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { CreateBloodRequestDto } from './dto/create-blood-request.dto';
import { CreateBloodRequestUpdateDto } from './dto/create-blood-request-update.dto';
import { RespondToBloodRequestDto } from './dto/respond-to-blood-request.dto';
import { UpdateDonorResponseDto } from './dto/update-donor-response.dto';
import { UpdateBloodRequestStatusDto } from './dto/update-blood-request-status.dto';
import { AdminCorrectCompletionDto } from './dto/admin-correct-completion.dto';
import {
  RespondToHospitalRequestDto,
  DispatchHospitalBloodTransferDto,
  ReceiveHospitalBloodTransferDto,
  UpdateHospitalRequestResponseStatusDto,
} from './dto/respond-to-hospital-request.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { AuditService } from '../../common/audit/audit.service';
import { AlertsService } from '../../common/alerts/alerts.service';
import { RealtimeService } from '../../common/realtime/realtime.service';
import { HospitalAccessService } from '../../common/rbac/hospital-access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { getCompatibilityRank, getCompatibleDonorGroups } from '../../common/utils/blood-compatibility';

@Injectable()
export class BloodRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly alerts: AlertsService,
    private readonly realtime: RealtimeService,
    private readonly hospitalAccess: HospitalAccessService,
    private readonly notifications: NotificationsService,
  ) {}

  private mapStatusToTracking(status: RequestStatus): RequestProgressStatus {
    const statusMap: Record<RequestStatus, RequestProgressStatus> = {
      OPEN: RequestProgressStatus.PENDING,
      MATCHING: RequestProgressStatus.MATCHED,
      FULFILLED: RequestProgressStatus.COMPLETED,
      CANCELLED: RequestProgressStatus.CANCELLED,
    };

    return statusMap[status];
  }

  private distanceKm(fromLat: number, fromLng: number, toLat: number, toLng: number) {
    const earthRadiusKm = 6371;
    const dLat = ((toLat - fromLat) * Math.PI) / 180;
    const dLng = ((toLng - fromLng) * Math.PI) / 180;
    const lat1 = (fromLat * Math.PI) / 180;
    const lat2 = (toLat * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private requestAllowsHospitalCoordination(requestSource: RequestSource) {
    return requestSource === RequestSource.HOSPITALS_ONLY || requestSource === RequestSource.DONORS_AND_HOSPITALS;
  }

  private isActiveRequestStatus(status: RequestStatus) {
    return status === RequestStatus.OPEN || status === RequestStatus.MATCHING;
  }

  private sanitizeHospitalActiveRequest<T extends { hospitalId: string; donorResponses?: unknown[] }>(
    request: T,
    viewerHospitalId?: string,
    role?: Role,
  ) {
    const canSeeDonorResponses =
      role === Role.ADMIN || role === Role.SUPER_ADMIN || (viewerHospitalId !== undefined && request.hospitalId === viewerHospitalId);

    return {
      ...request,
      isOwnRequest: viewerHospitalId !== undefined ? request.hospitalId === viewerHospitalId : false,
      donorResponses: canSeeDonorResponses ? request.donorResponses ?? [] : [],
    };
  }

  private async getHospitalStockSnapshot(hospitalId: string, bloodGroup: BloodGroup) {
    const inventory = await this.prisma.inventoryItem.findUnique({
      where: {
        hospitalId_bloodGroup: {
          hospitalId,
          bloodGroup,
        },
      },
      select: {
        bloodGroup: true,
        availableUnits: true,
        lowThreshold: true,
        criticalThreshold: true,
      },
    });

    const availableUnits = inventory?.availableUnits ?? 0;
    return {
      requestedBloodGroup: bloodGroup,
      availableUnits,
      compatibleUnits: availableUnits,
      isLowStock: inventory ? availableUnits <= inventory.lowThreshold : true,
      isCriticalStock: inventory ? availableUnits <= inventory.criticalThreshold : true,
    };
  }

  private async generateRequestReference(sequenceOffset = 0) {
    const year = new Date().getFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const nextYearStart = new Date(Date.UTC(year + 1, 0, 1));
    const existingThisYear = await this.prisma.bloodRequest.count({
      where: {
        createdAt: { gte: yearStart, lt: nextYearStart },
      },
    });

    let sequence = existingThisYear + 1 + sequenceOffset;
    while (sequence < existingThisYear + 1000) {
      const candidate = `BDR-${year}-${String(sequence).padStart(5, '0')}`;
      const existing = await this.prisma.bloodRequest.findUnique({
        where: { requestReference: candidate },
        select: { id: true },
      });
      if (!existing) {
        return candidate;
      }
      sequence += 1;
    }

    throw new BadRequestException('Unable to generate a unique request reference. Please try again.');
  }

  private async applyInventoryCreditForCompletion(
    tx: PrismaService,
    request: { id: string; hospitalId: string; bloodGroup: BloodGroup; unitsNeeded: number },
    actorUserId: string,
    reason: string,
  ) {
    const inventory = await tx.inventoryItem.upsert({
      where: {
        hospitalId_bloodGroup: {
          hospitalId: request.hospitalId,
          bloodGroup: request.bloodGroup,
        },
      },
      update: {
        availableUnits: { increment: request.unitsNeeded },
        updatedById: actorUserId,
      },
      create: {
        hospitalId: request.hospitalId,
        bloodGroup: request.bloodGroup,
        availableUnits: request.unitsNeeded,
        updatedById: actorUserId,
      },
    });

    const previousUnits = Math.max(0, inventory.availableUnits - request.unitsNeeded);
    await tx.inventoryLog.create({
      data: {
        inventoryId: inventory.id,
        changeType: InventoryChangeType.ADDED,
        unitsChanged: request.unitsNeeded,
        previousUnits,
        newUnits: inventory.availableUnits,
        reason,
        changedById: actorUserId,
      },
    });
  }

  async validateReference(requestReference: string) {
    const normalized = requestReference.trim().toUpperCase();
    if (!/^BDR-\d{4}-\d{5}$/.test(normalized)) {
      return { valid: false };
    }

    const request = await this.prisma.bloodRequest.findUnique({
      where: { requestReference: normalized },
      select: {
        requestReference: true,
        bloodGroup: true,
        status: true,
        hospital: { select: { hospitalName: true } },
      },
    });

    if (!request) {
      return { valid: false };
    }

    return {
      valid: true,
      requestReference: request.requestReference,
      hospitalName: request.hospital.hospitalName,
      bloodGroup: request.bloodGroup,
      status: request.status,
    };
  }

  async create(userId: string, dto: CreateBloodRequestDto) {
    const hospital = await this.hospitalAccess.getHospitalForUser(userId);
    const requestSource = dto.requestSource ?? RequestSource.DONORS_AND_HOSPITALS;
    const shouldTargetDonors = requestSource !== RequestSource.HOSPITALS_ONLY;
    const shouldTargetHospitals = requestSource !== RequestSource.DONORS_ONLY;

    if (dto.bloodGroup === BloodGroup.UNKNOWN) {
      throw new BadRequestException('Select a confirmed blood group for blood requests.');
    }

    const donorTarget = dto.type === 'EMERGENCY' || dto.priority === 'CRITICAL' ? 100 : 50;
    const compatibleGroups = getCompatibleDonorGroups(dto.bloodGroup);
    const normalizedLocation = dto.location.trim();
    const requiredByDate = new Date(dto.requiredBy);
    const radiusKm = dto.radiusKm ?? 10;

    if (!normalizedLocation) {
      throw new BadRequestException('location is required');
    }

    if (requiredByDate <= new Date()) {
      throw new BadRequestException('requiredBy must be in the future');
    }

    if (dto.type === 'EMERGENCY') {
      if (!dto.ward?.trim()) throw new BadRequestException('Please enter the ward or unit for this emergency request.');
      if (!dto.city?.trim()) throw new BadRequestException('Please provide the hospital city before submitting this emergency request.');
      if (!dto.region?.trim()) throw new BadRequestException('Please provide the hospital region before submitting this emergency request.');
      if (typeof dto.latitude !== 'number' || typeof dto.longitude !== 'number') {
        throw new BadRequestException('Please provide valid map coordinates before submitting this emergency request.');
      }
    }

    const baseMatchedDonors = shouldTargetDonors
      ? await this.prisma.donor.findMany({
          where: {
            bloodGroup: { in: compatibleGroups },
            NOT: { bloodGroup: BloodGroup.UNKNOWN },
            eligibilityStatus: true,
            availabilityStatus: true,
            user: {
              isActive: true,
              emailVerified: true,
            },
            clinicalRecords: {
              some: { status: DonorClinicalStatus.APPROVED },
              none: {
                status: {
                  in: [
                    DonorClinicalStatus.REJECTED,
                    DonorClinicalStatus.TEMPORARILY_DEFERRED,
                    DonorClinicalStatus.PERMANENTLY_DEFERRED,
                  ],
                },
              },
            },
            ...(dto.type === 'EMERGENCY' && typeof dto.latitude === 'number' && typeof dto.longitude === 'number'
              ? {
                  locationSharingEnabled: true,
                  latitude: { not: null },
                  longitude: { not: null },
                }
              : {
                  location: { contains: normalizedLocation, mode: 'insensitive' },
                }),
          },
          select: { id: true, userId: true, bloodGroup: true, latitude: true, longitude: true, location: true },
          take: 500,
        })
      : [];

    const rankedDonors = baseMatchedDonors
      .map((donor) => ({
        ...donor,
        distanceKm:
          dto.type === 'EMERGENCY' &&
          typeof dto.latitude === 'number' &&
          typeof dto.longitude === 'number' &&
          typeof donor.latitude === 'number' &&
          typeof donor.longitude === 'number'
            ? this.distanceKm(dto.latitude, dto.longitude, donor.latitude, donor.longitude)
            : null,
      }))
      .filter((donor) => {
        if (
          dto.type === 'EMERGENCY' &&
          typeof dto.latitude === 'number' &&
          typeof dto.longitude === 'number' &&
          donor.distanceKm !== null
        ) {
          return donor.distanceKm <= radiusKm;
        }
        return true;
      })
      .sort((a, b) => {
        const compatibilityDelta =
          getCompatibilityRank(dto.bloodGroup, a.bloodGroup) - getCompatibilityRank(dto.bloodGroup, b.bloodGroup);
        if (compatibilityDelta !== 0) return compatibilityDelta;
        if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
        if (a.distanceKm !== null) return -1;
        if (b.distanceKm !== null) return 1;
        return 0;
      })
      .slice(0, donorTarget);

    const matchedDonors = rankedDonors.map((donor) => ({
      id: donor.id,
      userId: donor.userId,
      distanceKm: donor.distanceKm,
    }));

    if (shouldTargetDonors && matchedDonors.length < dto.unitsNeeded && dto.type === 'EMERGENCY') {
      this.alerts.notifyCritical('LOW_MATCH_COVERAGE', {
        requestLocation: normalizedLocation,
        bloodGroup: dto.bloodGroup,
        unitsNeeded: dto.unitsNeeded,
        matchedDonors: matchedDonors.length,
      });
    }

    const matchedHospitals = shouldTargetHospitals
      ? await this.prisma.hospital.findMany({
          where: {
            id: { not: hospital.id },
            isApproved: true,
            bloodBankAvailable: true,
            user: { isActive: true, emailVerified: true },
            inventoryItems: { some: { bloodGroup: dto.bloodGroup, availableUnits: { gt: 0 } } },
          },
          select: {
            id: true,
            hospitalName: true,
            userId: true,
            latitude: true,
            longitude: true,
            inventoryItems: {
              where: { bloodGroup: dto.bloodGroup },
              select: { availableUnits: true },
              take: 1,
            },
          },
          take: 200,
        })
      : [];

    const matchedHospitalTargets = matchedHospitals
      .map((target) => {
        const distanceKm =
          dto.type === 'EMERGENCY' &&
          typeof dto.latitude === 'number' &&
          typeof dto.longitude === 'number' &&
          typeof target.latitude === 'number' &&
          typeof target.longitude === 'number'
            ? this.distanceKm(dto.latitude, dto.longitude, target.latitude, target.longitude)
            : null;
        return {
          ...target,
          availableUnits: target.inventoryItems[0]?.availableUnits ?? 0,
          distanceKm,
        };
      })
      .filter((target) => {
        if (
          dto.type === 'EMERGENCY' &&
          typeof dto.latitude === 'number' &&
          typeof dto.longitude === 'number' &&
          target.distanceKm !== null
        ) {
          return target.distanceKm <= radiusKm;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
        if (a.distanceKm !== null) return -1;
        if (b.distanceKm !== null) return 1;
        return b.availableUnits - a.availableUnits;
      });

    const hospitalPatientReference = dto.hospitalPatientReference?.trim() || dto.patientCode?.trim() || null;
    let request: Prisma.BloodRequestGetPayload<{ include: { matchedDonors: true } }> | null = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const requestReference = await this.generateRequestReference(attempt);
      try {
        request = await this.prisma.bloodRequest.create({
          data: {
            hospitalId: hospital.id,
            patientName: dto.patientName,
            requestReference,
            hospitalPatientReference,
            patientCode: hospitalPatientReference,
            bloodGroup: dto.bloodGroup,
            unitsNeeded: dto.unitsNeeded,
            type: dto.type,
            priority: dto.priority,
            requestSource,
            location: normalizedLocation,
            hospitalCenterName: dto.hospitalCenterName?.trim() || hospital.hospitalName,
            ward: dto.ward?.trim() || null,
            emergencyLocation: dto.emergencyLocation?.trim() || normalizedLocation,
            city: dto.city?.trim() || null,
            region: dto.region?.trim() || null,
            locationNotes: dto.locationNotes?.trim() || null,
            latitude: dto.latitude,
            longitude: dto.longitude,
            requiredBy: requiredByDate,
            notes: dto.notes,
            status: RequestStatus.MATCHING,
            trackingStatus: RequestProgressStatus.PENDING,
            matchedDonors: { connect: matchedDonors.map((d) => ({ id: d.id })) },
          },
          include: { matchedDonors: true },
        });
        break;
      } catch (error) {
        const isReferenceCollision =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          (Array.isArray(error.meta?.target)
            ? error.meta.target.includes('requestReference')
            : String(error.meta?.target ?? '').includes('requestReference'));
        if (!isReferenceCollision || attempt === 4) {
          throw error;
        }
      }
    }

    if (!request) {
      throw new BadRequestException('Unable to create blood request. Please try again.');
    }

    if (dto.type === 'EMERGENCY') {
      this.alerts.notifyCritical('EMERGENCY_REQUEST_CREATED', {
        requestId: request.id,
        requestReference: request.requestReference,
        bloodGroup: request.bloodGroup,
        city: dto.city ?? null,
        region: dto.region ?? null,
        ward: dto.ward ?? null,
      });
    }

    await this.audit.log('BLOOD_REQUEST_CREATED', 'BLOOD_REQUEST', userId, request.id, {
      matchedDonorCount: matchedDonors.length,
      matchedHospitalCount: matchedHospitalTargets.length,
      matchingRadiusKm: radiusKm,
      requestSource,
      requestReference: request.requestReference,
      hospitalPatientReference,
    });

    await this.prisma.bloodRequestUpdate.create({
      data: {
        bloodRequestId: request.id,
        updatedById: userId,
        oldStatus: null,
        newStatus: RequestProgressStatus.PENDING,
        comment: 'Request created',
      },
    });

    if (shouldTargetDonors && matchedDonors.length > 0) {
      await this.prisma.donorResponse.createMany({
        data: matchedDonors.map((donor) => ({
          bloodRequestId: request.id,
          donorId: donor.id,
          responseStatus: DonorResponseStatus.PENDING,
        })),
        skipDuplicates: true,
      });
    }

    if (shouldTargetDonors) {
      await Promise.all(
        matchedDonors.map((donor) =>
          this.notifications.createAndBroadcastNotification({
            userId: donor.userId,
            bloodRequestId: request.id,
            title: `${dto.priority === 'CRITICAL' ? 'Critical' : 'Urgent'} ${dto.bloodGroup} blood request`,
            body: [
              `Blood Request ${request.requestReference} requires ${dto.bloodGroup} blood.`,
              `${hospital.hospitalName} needs ${dto.unitsNeeded} units.`,
              `Urgency: ${dto.priority}.`,
              `Required by: ${requiredByDate.toLocaleString()}.`,
              donor.distanceKm !== null ? `Distance: ${donor.distanceKm.toFixed(1)} km.` : null,
              `Request source: ${requestSource}.`,
              `Respond now: /donor/emergency-requests?requestId=${request.id}`,
            ]
              .filter(Boolean)
              .join(' '),
            channel: 'IN_APP',
            type: NotificationType.EMERGENCY_REQUEST,
            delivered: true,
          }),
        ),
      );
    }

    if (shouldTargetHospitals) {
      await Promise.all(
        matchedHospitalTargets.map((target) =>
          this.notifications.createAndBroadcastNotification({
            userId: target.userId,
            bloodRequestId: request.id,
            title: `${dto.priority === 'CRITICAL' ? 'Critical' : 'Urgent'} hospital blood coordination request`,
            body: [
              `Blood Request ${request.requestReference} requires ${dto.bloodGroup} blood.`,
              `${hospital.hospitalName} requests ${dto.unitsNeeded} units.`,
              `Your available ${dto.bloodGroup} units: ${target.availableUnits}.`,
              `Urgency: ${dto.priority}.`,
              `Required by: ${requiredByDate.toLocaleString()}.`,
              target.distanceKm !== null ? `Distance: ${target.distanceKm.toFixed(1)} km.` : null,
              `Request source: ${requestSource}.`,
            ]
              .filter(Boolean)
              .join(' '),
            channel: 'IN_APP',
            type: NotificationType.EMERGENCY_REQUEST,
            delivered: true,
          }),
        ),
      );
    }

    if (process.env.SMS_ENABLED === 'true' && shouldTargetDonors && matchedDonors.length > 0) {
      await this.audit.log('EMERGENCY_SMS_DISPATCH_TRIGGERED', 'BLOOD_REQUEST', userId, request.id, {
        matchedDonorCount: matchedDonors.length,
      });
      this.alerts.notifyCritical('EMERGENCY_SMS_DISPATCH_TRIGGERED', {
        requestId: request.id,
        requestReference: request.requestReference,
        matchedDonorCount: matchedDonors.length,
      });
    }

    await this.audit.log('REQUEST_SLA_INITIALIZED', 'BLOOD_REQUEST', userId, request.id, {
      reminderMinutes: [3, 6],
      escalationMinutes: 10,
      matchedDonorCount: matchedDonors.length,
      matchedHospitalCount: matchedHospitalTargets.length,
      matchingRadiusKm: radiusKm,
      requestSource,
      requestReference: request.requestReference,
    });

    await this.realtime.broadcastEmergencyRequest({
      requestId: request.id,
      requestReference: request.requestReference,
      status: request.status,
      trackingStatus: request.trackingStatus,
      bloodGroup: request.bloodGroup,
      unitsNeeded: request.unitsNeeded,
      priority: request.priority,
      requiredBy: request.requiredBy,
      hospitalCenterName: request.hospitalCenterName,
      location: request.location,
      emergencyLocation: request.emergencyLocation,
      city: request.city,
      region: request.region,
      ward: request.ward,
      requestSource,
      latitude: request.latitude,
      longitude: request.longitude,
      hospitalId: request.hospitalId,
      matchedDonorCount: matchedDonors.length,
      matchedHospitalCount: matchedHospitalTargets.length,
    }, {
      requestId: request.id,
      hospitalId: request.hospitalId,
      matchedDonorUserIds: shouldTargetDonors ? matchedDonors.map((donor) => donor.userId) : [],
      matchedHospitalUserIds: shouldTargetHospitals ? matchedHospitalTargets.map((target) => target.userId) : [],
      isPublicEmergency: request.type === 'EMERGENCY',
    });

    return request;
  }

  async listAll(userId: string, role: Role, query: PaginationQueryDto) {
    const skip = query.skip ?? 0;
    const take = query.take ?? 100;
    if (role === Role.DONOR) {
      const donor = await this.prisma.donor.findUnique({ where: { userId }, select: { id: true } });
      if (!donor) {
        throw new NotFoundException('Donor profile not found');
      }

      const donorRequests = await this.prisma.bloodRequest.findMany({
        where: { matchedDonors: { some: { id: donor.id } } },
        include: {
          hospital: { select: { hospitalName: true, location: true } },
          updates: { orderBy: { createdAt: 'desc' }, take: 5, include: { updatedBy: { select: { email: true, role: true } } } },
          donorResponses: {
            where: { donorId: donor.id },
            include: {
              donor: { select: { fullName: true, bloodGroup: true, location: true, user: { select: { email: true } } } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      });

      return donorRequests.map((request) => ({
        ...request,
        patientName: null,
        hospitalPatientReference: null,
        patientCode: null,
        notes: null,
      }));
    }

    return this.prisma.bloodRequest.findMany({
      include: {
        hospital: { select: { hospitalName: true, location: true } },
        matchedDonors: { select: { id: true, fullName: true, bloodGroup: true, location: true } },
        updates: { orderBy: { createdAt: 'desc' }, take: 5, include: { updatedBy: { select: { email: true, role: true } } } },
        donorResponses: {
          include: {
            donor: { select: { fullName: true, bloodGroup: true, location: true, user: { select: { email: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  async listPublicEmergencyRequests(query: PaginationQueryDto) {
    const skip = query.skip ?? 0;
    const take = Math.min(query.take ?? 25, 100);

    const requests = await this.prisma.bloodRequest.findMany({
      where: {
        type: 'EMERGENCY',
        status: {
          in: [RequestStatus.OPEN, RequestStatus.MATCHING],
        },
      },
      include: {
        hospital: {
          select: {
            hospitalName: true,
            location: true,
            address: true,
            contactPhone: true,
          },
        },
        donorResponses: {
          select: {
            responseStatus: true,
          },
        },
      },
      orderBy: [{ priority: 'desc' }, { requiredBy: 'asc' }, { createdAt: 'desc' }],
      skip,
      take,
    });

    return requests.map((request) => {
      const acceptedResponses = request.donorResponses.filter(
        (response) =>
          response.responseStatus === DonorResponseStatus.ACCEPTED ||
          response.responseStatus === DonorResponseStatus.DONATED,
      ).length;

      return {
        id: request.id,
        requestReference: request.requestReference,
        bloodGroup: request.bloodGroup,
        unitsNeeded: request.unitsNeeded,
        priority: request.priority,
        status: request.status,
        trackingStatus: request.trackingStatus,
        requestDate: request.createdAt,
        neededBy: request.requiredBy,
        lastUpdated: request.updatedAt,
        publicMessage:
          request.priority === 'CRITICAL'
            ? `Urgent ${request.bloodGroup.replace('_', ' ')} request requiring immediate donor response.`
            : `Hospital team needs ${request.unitsNeeded} unit(s) of ${request.bloodGroup.replace('_', ' ')} support.`,
        hospital: {
          name: request.hospital.hospitalName,
          location: request.hospital.location,
          address: request.hospital.address,
          contactPhone: request.hospital.contactPhone,
        },
        acceptedResponses,
      };
    });
  }

  private async getDonorForEmergencyAccess(userId: string) {
    const donor = await this.prisma.donor.findUnique({
      where: { userId },
      include: {
        clinicalRecords: {
          select: { status: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!donor) {
      throw new NotFoundException('Donor profile not found');
    }

    return donor;
  }

  private donorEmergencyInclude(donorId: string) {
    return {
      hospital: { select: { id: true, hospitalName: true, location: true, city: true, region: true, contactPhone: true } },
      updates: { orderBy: { createdAt: 'desc' as const }, take: 5, include: { updatedBy: { select: { email: true, role: true } } } },
      donorResponses: {
        where: { donorId },
        include: {
          donor: {
            select: {
              id: true,
              donorNumber: true,
              fullName: true,
              bloodGroup: true,
              location: true,
              availabilityStatus: true,
              eligibilityStatus: true,
              locationSharingEnabled: true,
              lastDonationDate: true,
              nextEligibilityDate: true,
              user: { select: { email: true } },
            },
          },
        },
      },
    };
  }

  private sanitizeDonorEmergencyRequest<T extends Record<string, any>>(request: T, donor: { latitude?: number | null; longitude?: number | null; bloodGroup: BloodGroup; eligibilityStatus: boolean; availabilityStatus: boolean; locationSharingEnabled: boolean; nextEligibilityDate?: Date | null }) {
    const distanceKm =
      typeof donor.latitude === 'number' &&
      typeof donor.longitude === 'number' &&
      typeof request.latitude === 'number' &&
      typeof request.longitude === 'number'
        ? Number(this.distanceKm(donor.latitude, donor.longitude, request.latitude, request.longitude).toFixed(2))
        : null;
    const nextEligibilityDate = donor.nextEligibilityDate ?? null;
    const inCooldown = Boolean(nextEligibilityDate && nextEligibilityDate > new Date());

    return {
      ...request,
      patientName: null,
      hospitalPatientReference: null,
      patientCode: null,
      donorMatchContext: {
        bloodGroup: donor.bloodGroup,
        compatible: getCompatibleDonorGroups(request.bloodGroup).includes(donor.bloodGroup),
        eligible: donor.eligibilityStatus,
        available: donor.availabilityStatus,
        inCooldown,
        locationSharingEnabled: donor.locationSharingEnabled,
        distanceKm,
      },
    };
  }

  async listDonorEmergencyRequests(userId: string, query: PaginationQueryDto) {
    const skip = query.skip ?? 0;
    const take = Math.min(query.take ?? 25, 100);
    const donor = await this.getDonorForEmergencyAccess(userId);

    const requests = await this.prisma.bloodRequest.findMany({
      where: {
        matchedDonors: { some: { id: donor.id } },
        type: 'EMERGENCY',
        status: { in: [RequestStatus.OPEN, RequestStatus.MATCHING] },
        requestSource: { in: [RequestSource.DONORS_ONLY, RequestSource.DONORS_AND_HOSPITALS] },
      },
      include: this.donorEmergencyInclude(donor.id),
      orderBy: [{ priority: 'desc' }, { requiredBy: 'asc' }, { createdAt: 'desc' }],
      skip,
      take,
    });

    return requests.map((request) => this.sanitizeDonorEmergencyRequest(request, donor));
  }

  async getDonorEmergencyRequestById(id: string, userId: string) {
    const donor = await this.getDonorForEmergencyAccess(userId);

    const request = await this.prisma.bloodRequest.findFirst({
      where: {
        id,
        matchedDonors: { some: { id: donor.id } },
        requestSource: { in: [RequestSource.DONORS_ONLY, RequestSource.DONORS_AND_HOSPITALS] },
      },
      include: this.donorEmergencyInclude(donor.id),
    });

    if (!request) {
      throw new NotFoundException('This emergency request is no longer available to your account.');
    }

    return this.sanitizeDonorEmergencyRequest(request, donor);
  }

  async listMine(userId: string, role: Role, query: PaginationQueryDto) {
    const skip = query.skip ?? 0;
    const take = query.take ?? 100;
    if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
      return this.listAll(userId, Role.ADMIN, query);
    }

    const hospital = await this.hospitalAccess.getHospitalForUser(userId);

    return this.prisma.bloodRequest.findMany({
      where: { hospitalId: hospital.id },
      include: {
        hospital: { select: { hospitalName: true, location: true } },
        matchedDonors: { select: { id: true, fullName: true, bloodGroup: true, location: true } },
        updates: { orderBy: { createdAt: 'desc' }, take: 5, include: { updatedBy: { select: { email: true, role: true } } } },
        donorResponses: {
          include: { donor: { select: { fullName: true, bloodGroup: true, location: true, user: { select: { email: true } } } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  async listHospitalActive(userId: string, role: Role, query: PaginationQueryDto) {
    const skip = query.skip ?? 0;
    const take = Math.min(query.take ?? 100, 100);
    const isAdmin = role === Role.ADMIN || role === Role.SUPER_ADMIN;
    const hospital = isAdmin ? null : await this.hospitalAccess.getHospitalForUser(userId);

    const requests = await this.prisma.bloodRequest.findMany({
      where: isAdmin
        ? {
            status: { in: [RequestStatus.OPEN, RequestStatus.MATCHING] },
            requestSource: { in: [RequestSource.HOSPITALS_ONLY, RequestSource.DONORS_AND_HOSPITALS] },
          }
        : {
            OR: [
              {
                hospitalId: hospital!.id,
                status: { in: [RequestStatus.OPEN, RequestStatus.MATCHING] },
              },
              {
                hospitalId: { not: hospital!.id },
                status: { in: [RequestStatus.OPEN, RequestStatus.MATCHING] },
                requestSource: { in: [RequestSource.HOSPITALS_ONLY, RequestSource.DONORS_AND_HOSPITALS] },
              },
            ],
          },
      include: {
        hospital: { select: { id: true, hospitalName: true, location: true, city: true, region: true, contactPhone: true } },
        updates: { orderBy: { createdAt: 'desc' }, take: 5, include: { updatedBy: { select: { email: true, role: true } } } },
        donorResponses: {
          include: {
            donor: { select: { id: true, donorNumber: true, fullName: true, bloodGroup: true, location: true, user: { select: { email: true } } } },
          },
        },
        hospitalResponses: {
          orderBy: { createdAt: 'desc' },
          include: {
            respondingHospital: {
              select: { id: true, hospitalName: true, location: true, city: true, region: true, contactPhone: true },
            },
            transfer: true,
          },
        },
      },
      orderBy: [{ priority: 'desc' }, { requiredBy: 'asc' }, { createdAt: 'desc' }],
      skip,
      take,
    });

    return Promise.all(
      requests.map(async (request) => ({
        ...this.sanitizeHospitalActiveRequest(request, hospital?.id, role),
        currentHospitalStock: hospital ? await this.getHospitalStockSnapshot(hospital.id, request.bloodGroup) : null,
        currentHospitalResponse: hospital
          ? request.hospitalResponses.find((response) => response.respondingHospitalId === hospital.id) ?? null
          : null,
      })),
    );
  }

  async listHospitalHistory(userId: string, role: Role, query: PaginationQueryDto) {
    const skip = query.skip ?? 0;
    const take = Math.min(query.take ?? 100, 100);
    const isAdmin = role === Role.ADMIN || role === Role.SUPER_ADMIN;
    const hospital = isAdmin ? null : await this.hospitalAccess.getHospitalForUser(userId);
    const archivedStatuses = [RequestStatus.FULFILLED, RequestStatus.CANCELLED];

    const requests = await this.prisma.bloodRequest.findMany({
      where: isAdmin
        ? {
            status: { in: archivedStatuses },
          }
        : {
            status: { in: archivedStatuses },
            OR: [
              { hospitalId: hospital!.id },
              {
                hospitalResponses: {
                  some: { respondingHospitalId: hospital!.id },
                },
              },
              {
                hospitalTransfers: {
                  some: {
                    OR: [{ supplyingHospitalId: hospital!.id }, { receivingHospitalId: hospital!.id }],
                  },
                },
              },
            ],
          },
      include: {
        hospital: { select: { id: true, hospitalName: true, location: true, city: true, region: true, contactPhone: true } },
        updates: {
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: { updatedBy: { select: { email: true, role: true } } },
        },
        donorResponses: {
          include: {
            donor: { select: { id: true, donorNumber: true, fullName: true, bloodGroup: true, location: true, user: { select: { email: true } } } },
          },
        },
        hospitalResponses: {
          orderBy: { createdAt: 'desc' },
          include: {
            respondingHospital: {
              select: { id: true, hospitalName: true, location: true, city: true, region: true, contactPhone: true },
            },
            transfer: true,
          },
        },
        hospitalTransfers: {
          orderBy: { createdAt: 'desc' },
          include: {
            supplyingHospital: {
              select: { id: true, hospitalName: true, location: true, city: true, region: true, contactPhone: true },
            },
            receivingHospital: {
              select: { id: true, hospitalName: true, location: true, city: true, region: true, contactPhone: true },
            },
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      skip,
      take,
    });

    return requests.map((request) => ({
      ...this.sanitizeHospitalActiveRequest(request, hospital?.id, role),
      currentHospitalStock: null,
      currentHospitalResponse: hospital
        ? request.hospitalResponses.find((response) => response.respondingHospitalId === hospital.id) ?? null
        : null,
    }));
  }

  async getHospitalActiveById(id: string, userId: string, role: Role) {
    const isAdmin = role === Role.ADMIN || role === Role.SUPER_ADMIN;
    const hospital = isAdmin ? null : await this.hospitalAccess.getHospitalForUser(userId);
    const request = await this.prisma.bloodRequest.findUnique({
      where: { id },
      include: {
        hospital: { select: { id: true, hospitalName: true, location: true, city: true, region: true, contactPhone: true } },
        updates: {
          orderBy: { createdAt: 'desc' },
          include: { updatedBy: { select: { email: true, role: true } } },
        },
        donorResponses: {
          orderBy: { createdAt: 'desc' },
          include: {
            donor: { select: { id: true, donorNumber: true, fullName: true, bloodGroup: true, location: true, user: { select: { email: true } } } },
          },
        },
        hospitalResponses: {
          orderBy: { createdAt: 'desc' },
          include: {
            respondingHospital: {
              select: { id: true, hospitalName: true, location: true, city: true, region: true, contactPhone: true },
            },
            transfer: true,
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Blood request not found');
    }

    const isOwnRequest = hospital?.id === request.hospitalId;
    const canSeeExternalRequest =
      this.isActiveRequestStatus(request.status) && this.requestAllowsHospitalCoordination(request.requestSource);
    if (!isAdmin && !isOwnRequest && !canSeeExternalRequest) {
      throw new NotFoundException('Blood request not found');
    }

    return {
      ...this.sanitizeHospitalActiveRequest(request, hospital?.id, role),
      currentHospitalStock: hospital ? await this.getHospitalStockSnapshot(hospital.id, request.bloodGroup) : null,
      currentHospitalResponse: hospital
        ? request.hospitalResponses.find((response) => response.respondingHospitalId === hospital.id) ?? null
        : null,
    };
  }

  async updateHospitalActiveStatus(id: string, userId: string, role: Role, dto: UpdateBloodRequestStatusDto) {
    if (![RequestStatus.FULFILLED, RequestStatus.CANCELLED, RequestStatus.OPEN, RequestStatus.MATCHING].includes(dto.status)) {
      throw new BadRequestException('Unsupported request status.');
    }

    const request = await this.prisma.bloodRequest.findUnique({
      where: { id },
      include: { hospital: { select: { userId: true } } },
    });
    if (!request) {
      throw new NotFoundException('Blood request not found');
    }
    await this.hospitalAccess.assertHospitalAccess(request.hospitalId, userId, role);

    const mappedTrackingStatus = this.mapStatusToTracking(dto.status);
    const updated = await this.prisma.$transaction(async (tx) => {
      const nextRequest = await tx.bloodRequest.update({
        where: { id },
        data: {
          status: dto.status,
          trackingStatus: mappedTrackingStatus,
        },
      });

      await tx.bloodRequestUpdate.create({
        data: {
          bloodRequestId: id,
          updatedById: userId,
          oldStatus: request.trackingStatus,
          newStatus: mappedTrackingStatus,
          comment: dto.comment ?? `Hospital coordination status moved to ${dto.status}. Inventory transfer remains manual.`,
        },
      });

      return nextRequest;
    });

    await this.audit.log('HOSPITAL_ACTIVE_REQUEST_STATUS_UPDATED', 'BLOOD_REQUEST', userId, id, {
      status: dto.status,
      requestReference: request.requestReference,
      inventoryTransfer: 'manual',
    });

    await this.realtime.broadcastEmergencyRequest(
      {
        requestId: id,
        requestReference: request.requestReference,
        status: updated.status,
        trackingStatus: updated.trackingStatus,
        hospitalId: request.hospitalId,
      },
      {
        requestId: id,
        hospitalId: request.hospitalId,
        isPublicEmergency: request.type === 'EMERGENCY',
      },
    );

    return updated;
  }

  async respondAsHospital(id: string, userId: string, role: Role, dto: RespondToHospitalRequestDto) {
    const hospital = await this.hospitalAccess.getHospitalForUser(userId);
    const request = await this.prisma.bloodRequest.findUnique({
      where: { id },
      include: { hospital: { select: { id: true, hospitalName: true, userId: true } } },
    });
    if (!request) {
      throw new NotFoundException('Blood request not found');
    }
    if (request.hospitalId === hospital.id) {
      throw new BadRequestException('A hospital cannot respond as supplier to its own request.');
    }
    if (!this.isActiveRequestStatus(request.status)) {
      throw new BadRequestException('This request is not open for hospital responses.');
    }
    if (!this.requestAllowsHospitalCoordination(request.requestSource)) {
      throw new BadRequestException('This request is not targeted to hospitals.');
    }

    const responseType = dto.responseType;
    const bloodGroupOffered = dto.bloodGroupOffered ?? request.bloodGroup;
    if (responseType === HospitalRequestResponseType.OFFERED && bloodGroupOffered !== request.bloodGroup) {
      throw new BadRequestException('Hospital offers must match the requested blood group.');
    }

    const stock = await this.getHospitalStockSnapshot(hospital.id, request.bloodGroup);
    if (responseType === HospitalRequestResponseType.OFFERED) {
      const unitsOffered = dto.unitsOffered ?? 0;
      if (unitsOffered < 1) {
        throw new BadRequestException('Offer at least 1 unit.');
      }
      if (unitsOffered > stock.availableUnits) {
        throw new BadRequestException(`Cannot offer more than available stock (${stock.availableUnits} unit(s)).`);
      }
    }

    const response = await this.prisma.hospitalBloodRequestResponse.upsert({
      where: {
        requestId_respondingHospitalId: {
          requestId: id,
          respondingHospitalId: hospital.id,
        },
      },
      update: {
        responseType,
        unitsOffered: responseType === HospitalRequestResponseType.OFFERED ? dto.unitsOffered : null,
        bloodGroupOffered: responseType === HospitalRequestResponseType.OFFERED ? bloodGroupOffered : null,
        note: dto.note?.trim() || null,
        status: HospitalRequestResponseStatus.PENDING,
      },
      create: {
        requestId: id,
        respondingHospitalId: hospital.id,
        responseType,
        unitsOffered: responseType === HospitalRequestResponseType.OFFERED ? dto.unitsOffered : null,
        bloodGroupOffered: responseType === HospitalRequestResponseType.OFFERED ? bloodGroupOffered : null,
        note: dto.note?.trim() || null,
      },
      include: {
        respondingHospital: {
          select: { id: true, hospitalName: true, location: true, city: true, region: true, contactPhone: true },
        },
      },
    });

    await this.audit.log('HOSPITAL_BLOOD_REQUEST_RESPONSE_SUBMITTED', 'BLOOD_REQUEST', userId, id, {
      responseId: response.id,
      requestReference: request.requestReference,
      responseType,
      unitsOffered: response.unitsOffered,
      respondingHospitalId: hospital.id,
    });

    await this.notifications.createAndBroadcastNotification({
      userId: request.hospital.userId,
      bloodRequestId: request.id,
      title:
        responseType === HospitalRequestResponseType.OFFERED
          ? `${hospital.hospitalName} offered ${response.unitsOffered} unit(s)`
          : `${hospital.hospitalName} cannot fulfill request`,
      body:
        responseType === HospitalRequestResponseType.OFFERED
          ? `${hospital.hospitalName} offered ${response.unitsOffered} unit(s) of ${request.bloodGroup} for ${request.requestReference}.`
          : `${hospital.hospitalName} marked ${request.requestReference} as cannot fulfill.`,
      channel: 'IN_APP',
      type: NotificationType.EMERGENCY_REQUEST,
      delivered: true,
    });

    await this.realtime.broadcastEmergencyRequest(
      {
        requestId: id,
        requestReference: request.requestReference,
        hospitalId: request.hospitalId,
        hospitalResponseId: response.id,
        hospitalResponseStatus: response.status,
      },
      {
        requestId: id,
        hospitalId: request.hospitalId,
        matchedHospitalUserIds: [userId, request.hospital.userId],
        isPublicEmergency: request.type === 'EMERGENCY',
      },
    );

    return response;
  }

  async updateHospitalResponseStatus(
    id: string,
    responseId: string,
    userId: string,
    role: Role,
    dto: UpdateHospitalRequestResponseStatusDto,
  ) {
    const response = await this.prisma.hospitalBloodRequestResponse.findUnique({
      where: { id: responseId },
      include: {
        request: { include: { hospital: { select: { id: true, userId: true, hospitalName: true } } } },
        respondingHospital: { select: { id: true, userId: true, hospitalName: true } },
      },
    });
    if (!response || response.requestId !== id) {
      throw new NotFoundException('Hospital response not found');
    }
    await this.hospitalAccess.assertHospitalAccess(response.request.hospitalId, userId, role);
    const allowedResponseStatuses: HospitalRequestResponseStatus[] = [
      HospitalRequestResponseStatus.ACCEPTED,
      HospitalRequestResponseStatus.REJECTED,
      HospitalRequestResponseStatus.CANCELLED,
    ];
    if (!allowedResponseStatuses.includes(dto.status)) {
      throw new BadRequestException('Unsupported hospital response status update.');
    }
    if (response.responseType !== HospitalRequestResponseType.OFFERED && dto.status === HospitalRequestResponseStatus.ACCEPTED) {
      throw new BadRequestException('Only unit offers can be accepted.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextResponse = await tx.hospitalBloodRequestResponse.update({
        where: { id: responseId },
        data: { status: dto.status },
        include: {
          respondingHospital: {
            select: { id: true, hospitalName: true, location: true, city: true, region: true, contactPhone: true },
          },
          transfer: true,
        },
      });

      if (dto.status === HospitalRequestResponseStatus.ACCEPTED) {
        await tx.hospitalBloodTransfer.upsert({
          where: { responseId },
          update: {
            status: HospitalBloodTransferStatus.ACCEPTED,
            units: response.unitsOffered ?? 0,
            bloodGroup: response.bloodGroupOffered ?? response.request.bloodGroup,
          },
          create: {
            requestId: id,
            responseId,
            supplyingHospitalId: response.respondingHospitalId,
            receivingHospitalId: response.request.hospitalId,
            bloodGroup: response.bloodGroupOffered ?? response.request.bloodGroup,
            units: response.unitsOffered ?? 0,
            status: HospitalBloodTransferStatus.ACCEPTED,
          },
        });
        await tx.bloodRequestUpdate.create({
          data: {
            bloodRequestId: id,
            updatedById: userId,
            oldStatus: response.request.trackingStatus,
            newStatus: response.request.trackingStatus,
            comment: `Accepted offer from ${response.respondingHospital.hospitalName}; awaiting dispatch.`,
          },
        });
      } else if (dto.status === HospitalRequestResponseStatus.CANCELLED) {
        await tx.hospitalBloodTransfer.updateMany({
          where: { responseId, status: HospitalBloodTransferStatus.ACCEPTED },
          data: { status: HospitalBloodTransferStatus.CANCELLED },
        });
      }

      return nextResponse;
    });

    await this.audit.log('HOSPITAL_BLOOD_REQUEST_RESPONSE_STATUS_UPDATED', 'BLOOD_REQUEST', userId, id, {
      responseId,
      requestReference: response.request.requestReference,
      status: dto.status,
      respondingHospitalId: response.respondingHospitalId,
    });

    await this.notifications.createAndBroadcastNotification({
      userId: response.respondingHospital.userId,
      bloodRequestId: id,
      title: dto.status === HospitalRequestResponseStatus.ACCEPTED ? 'Offer accepted - dispatch requested' : `Hospital offer ${dto.status.toLowerCase()}`,
      body:
        dto.status === HospitalRequestResponseStatus.ACCEPTED
          ? `Your offer for ${response.request.requestReference} was accepted. Please dispatch blood.`
          : `${response.request.hospital.hospitalName} ${dto.status.toLowerCase()} your response for ${response.request.requestReference}.`,
      channel: 'IN_APP',
      type: NotificationType.EMERGENCY_REQUEST,
      delivered: true,
    });

    await this.realtime.broadcastEmergencyRequest(
      {
        requestId: id,
        requestReference: response.request.requestReference,
        hospitalId: response.request.hospitalId,
        hospitalResponseId: responseId,
        hospitalResponseStatus: dto.status,
      },
      {
        requestId: id,
        hospitalId: response.request.hospitalId,
        matchedHospitalUserIds: [response.respondingHospital.userId, response.request.hospital.userId],
        isPublicEmergency: response.request.type === 'EMERGENCY',
      },
    );

    return updated;
  }

  async dispatchHospitalTransfer(
    id: string,
    responseId: string,
    userId: string,
    role: Role,
    dto: DispatchHospitalBloodTransferDto,
  ) {
    const hospital = await this.hospitalAccess.getHospitalForUser(userId);
    const transfer = await this.prisma.hospitalBloodTransfer.findUnique({
      where: { responseId },
      include: {
        request: { include: { hospital: { select: { id: true, hospitalName: true, userId: true } } } },
        response: true,
        supplyingHospital: { select: { id: true, hospitalName: true, userId: true } },
        receivingHospital: { select: { id: true, hospitalName: true, userId: true } },
      },
    });
    if (!transfer || transfer.requestId !== id) {
      throw new NotFoundException('Hospital transfer not found');
    }
    if (transfer.supplyingHospitalId !== hospital.id) {
      throw new ForbiddenException('Only the supplying hospital can dispatch this transfer.');
    }
    if (transfer.response.status !== HospitalRequestResponseStatus.ACCEPTED || transfer.status !== HospitalBloodTransferStatus.ACCEPTED) {
      throw new BadRequestException('Dispatch is allowed only after an accepted offer and before dispatch.');
    }
    if (dto.units > transfer.units) {
      throw new BadRequestException('Dispatch units cannot exceed accepted units.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const supplierInventory = await tx.inventoryItem.findUnique({
        where: {
          hospitalId_bloodGroup: {
            hospitalId: transfer.supplyingHospitalId,
            bloodGroup: transfer.bloodGroup,
          },
        },
      });
      if (!supplierInventory || supplierInventory.availableUnits < dto.units) {
        throw new BadRequestException('Insufficient stock to dispatch this accepted offer.');
      }

      const updatedCount = await tx.inventoryItem.updateMany({
        where: {
          id: supplierInventory.id,
          availableUnits: { gte: dto.units },
        },
        data: {
          availableUnits: { decrement: dto.units },
          updatedById: userId,
        },
      });
      if (updatedCount.count !== 1) {
        throw new BadRequestException('Insufficient stock to dispatch this accepted offer.');
      }

      const updatedInventory = await tx.inventoryItem.findUniqueOrThrow({ where: { id: supplierInventory.id } });
      const inventoryLog = await tx.inventoryLog.create({
        data: {
          inventoryId: supplierInventory.id,
          changeType: InventoryChangeType.USED,
          unitsChanged: dto.units,
          previousUnits: supplierInventory.availableUnits,
          newUnits: updatedInventory.availableUnits,
          reason: `Dispatched ${dto.units} ${transfer.bloodGroup} unit(s) to ${transfer.receivingHospital.hospitalName} for ${transfer.request.requestReference}`,
          changedById: userId,
        },
      });

      const updatedTransfer = await tx.hospitalBloodTransfer.update({
        where: { id: transfer.id },
        data: {
          status: HospitalBloodTransferStatus.DISPATCHED,
          dispatchedUnits: dto.units,
          dispatchNote: dto.dispatchNote?.trim() || null,
          dispatchReference: dto.dispatchReference?.trim() || null,
          dispatchedAt: new Date(),
        },
      });

      await tx.bloodRequestUpdate.create({
        data: {
          bloodRequestId: id,
          updatedById: userId,
          oldStatus: transfer.request.trackingStatus,
          newStatus: transfer.request.trackingStatus,
          comment: `${transfer.supplyingHospital.hospitalName} dispatched ${dto.units} ${transfer.bloodGroup} unit(s). Awaiting receipt confirmation.`,
        },
      });

      return { updatedTransfer, updatedInventory, inventoryLog };
    });

    await this.audit.log('HOSPITAL_BLOOD_TRANSFER_DISPATCHED', 'BLOOD_REQUEST', userId, id, {
      transferId: transfer.id,
      responseId,
      requestReference: transfer.request.requestReference,
      units: dto.units,
      bloodGroup: transfer.bloodGroup,
      supplyingHospitalId: transfer.supplyingHospitalId,
      receivingHospitalId: transfer.receivingHospitalId,
    });

    await this.notifications.createAndBroadcastNotification({
      userId: transfer.receivingHospital.userId,
      bloodRequestId: id,
      title: 'Blood dispatched',
      body: `Blood dispatched by ${transfer.supplyingHospital.hospitalName} for ${transfer.request.requestReference}.`,
      channel: 'IN_APP',
      type: NotificationType.EMERGENCY_REQUEST,
      delivered: true,
    });

    this.realtime.broadcastInventoryUpdate({
      inventoryId: result.updatedInventory.id,
      hospitalId: transfer.supplyingHospitalId,
      bloodGroup: transfer.bloodGroup,
      availableUnits: result.updatedInventory.availableUnits,
      updatedBy: userId,
    });
    await this.realtime.broadcastEmergencyRequest(
      {
        requestId: id,
        requestReference: transfer.request.requestReference,
        hospitalId: transfer.request.hospitalId,
        hospitalTransferId: transfer.id,
        hospitalTransferStatus: HospitalBloodTransferStatus.DISPATCHED,
      },
      {
        requestId: id,
        hospitalId: transfer.request.hospitalId,
        matchedHospitalUserIds: [transfer.supplyingHospital.userId, transfer.receivingHospital.userId],
        isPublicEmergency: transfer.request.type === 'EMERGENCY',
      },
    );

    return result.updatedTransfer;
  }

  async receiveHospitalTransfer(
    id: string,
    responseId: string,
    userId: string,
    role: Role,
    dto: ReceiveHospitalBloodTransferDto,
  ) {
    const hospital = await this.hospitalAccess.getHospitalForUser(userId);
    const transfer = await this.prisma.hospitalBloodTransfer.findUnique({
      where: { responseId },
      include: {
        request: { include: { hospital: { select: { id: true, hospitalName: true, userId: true } } } },
        response: true,
        supplyingHospital: { select: { id: true, hospitalName: true, userId: true } },
        receivingHospital: { select: { id: true, hospitalName: true, userId: true } },
      },
    });
    if (!transfer || transfer.requestId !== id) {
      throw new NotFoundException('Hospital transfer not found');
    }
    if (transfer.receivingHospitalId !== hospital.id) {
      throw new ForbiddenException('Only the receiving hospital can confirm receipt for this transfer.');
    }
    if (transfer.status !== HospitalBloodTransferStatus.DISPATCHED || !transfer.dispatchedUnits) {
      throw new BadRequestException('Receipt confirmation is allowed only after dispatch.');
    }
    if (dto.units > transfer.dispatchedUnits) {
      throw new BadRequestException('Received units cannot exceed dispatched units.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const inventory = await tx.inventoryItem.upsert({
        where: {
          hospitalId_bloodGroup: {
            hospitalId: transfer.receivingHospitalId,
            bloodGroup: transfer.bloodGroup,
          },
        },
        update: {
          availableUnits: { increment: dto.units },
          updatedById: userId,
        },
        create: {
          hospitalId: transfer.receivingHospitalId,
          bloodGroup: transfer.bloodGroup,
          availableUnits: dto.units,
          updatedById: userId,
        },
      });
      const previousUnits = inventory.availableUnits - dto.units;

      const inventoryLog = await tx.inventoryLog.create({
        data: {
          inventoryId: inventory.id,
          changeType: InventoryChangeType.ADDED,
          unitsChanged: dto.units,
          previousUnits,
          newUnits: inventory.availableUnits,
          reason: `Received ${dto.units} ${transfer.bloodGroup} unit(s) from ${transfer.supplyingHospital.hospitalName} for ${transfer.request.requestReference}`,
          changedById: userId,
        },
      });

      const updatedTransfer = await tx.hospitalBloodTransfer.update({
        where: { id: transfer.id },
        data: {
          status: HospitalBloodTransferStatus.RECEIVED,
          receivedUnits: dto.units,
          receivedNote: dto.receivedNote?.trim() || null,
          receivedCondition: dto.receivedCondition?.trim() || null,
          receivedAt: new Date(),
        },
      });

      const receivedTransfers = await tx.hospitalBloodTransfer.findMany({
        where: {
          requestId: id,
          status: HospitalBloodTransferStatus.RECEIVED,
        },
        select: { receivedUnits: true },
      });
      const receivedUnits = receivedTransfers.reduce((sum, item) => sum + (item.receivedUnits ?? 0), 0);

      if (receivedUnits >= transfer.request.unitsNeeded && transfer.request.status !== RequestStatus.FULFILLED) {
        await tx.bloodRequest.update({
          where: { id },
          data: {
            status: RequestStatus.FULFILLED,
            trackingStatus: RequestProgressStatus.COMPLETED,
          },
        });
      }

      await tx.bloodRequestUpdate.create({
        data: {
          bloodRequestId: id,
          updatedById: userId,
          oldStatus: transfer.request.trackingStatus,
          newStatus:
            receivedUnits >= transfer.request.unitsNeeded
              ? RequestProgressStatus.COMPLETED
              : transfer.request.trackingStatus,
          comment: `${transfer.receivingHospital.hospitalName} received ${dto.units} ${transfer.bloodGroup} unit(s) from ${transfer.supplyingHospital.hospitalName}.`,
        },
      });

      return { updatedTransfer, inventory, inventoryLog, receivedUnits };
    });

    await this.audit.log('HOSPITAL_BLOOD_TRANSFER_RECEIVED', 'BLOOD_REQUEST', userId, id, {
      transferId: transfer.id,
      responseId,
      requestReference: transfer.request.requestReference,
      units: dto.units,
      bloodGroup: transfer.bloodGroup,
      supplyingHospitalId: transfer.supplyingHospitalId,
      receivingHospitalId: transfer.receivingHospitalId,
    });

    await this.notifications.createAndBroadcastNotification({
      userId: transfer.supplyingHospital.userId,
      bloodRequestId: id,
      title: 'Blood receipt confirmed',
      body: `${transfer.receivingHospital.hospitalName} confirmed receipt for ${transfer.request.requestReference}.`,
      channel: 'IN_APP',
      type: NotificationType.EMERGENCY_REQUEST,
      delivered: true,
    });

    this.realtime.broadcastInventoryUpdate({
      inventoryId: result.inventory.id,
      hospitalId: transfer.receivingHospitalId,
      bloodGroup: transfer.bloodGroup,
      availableUnits: result.inventory.availableUnits,
      updatedBy: userId,
    });
    await this.realtime.broadcastEmergencyRequest(
      {
        requestId: id,
        requestReference: transfer.request.requestReference,
        hospitalId: transfer.request.hospitalId,
        hospitalTransferId: transfer.id,
        hospitalTransferStatus: HospitalBloodTransferStatus.RECEIVED,
      },
      {
        requestId: id,
        hospitalId: transfer.request.hospitalId,
        matchedHospitalUserIds: [transfer.supplyingHospital.userId, transfer.receivingHospital.userId],
        isPublicEmergency: transfer.request.type === 'EMERGENCY',
      },
    );

    return result.updatedTransfer;
  }

  async getById(id: string, userId: string, role: Role) {
    const request = await this.prisma.bloodRequest.findUnique({
      where: { id },
      include: {
        hospital: { select: { id: true, hospitalName: true, location: true, userId: true } },
        matchedDonors: { select: { id: true, fullName: true, bloodGroup: true, location: true } },
        updates: {
          orderBy: { createdAt: 'desc' },
          include: { updatedBy: { select: { email: true, role: true } } },
        },
        donorResponses: {
          orderBy: { createdAt: 'desc' },
          include: { donor: { select: { id: true, donorNumber: true, fullName: true, bloodGroup: true, location: true, user: { select: { email: true } } } } },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Blood request not found');
    }

    const isHospitalOperator = role === Role.HOSPITAL_STAFF || role === Role.BLOOD_BANK_OFFICER;
    if (isHospitalOperator) {
      await this.hospitalAccess.assertHospitalAccess(request.hospital.id, userId, role);
    }

    if (role === Role.DONOR) {
      const donor = await this.prisma.donor.findUnique({ where: { userId }, select: { id: true } });
      if (!donor) {
        throw new NotFoundException('Donor profile not found');
      }
      const hasAccess = request.matchedDonors.some((item) => item.id === donor.id);
      if (!hasAccess) {
        throw new NotFoundException('Blood request not found');
      }
    }

    return request;
  }

  async updateStatus(id: string, userId: string, role: Role, dto: UpdateBloodRequestStatusDto) {
    const request = await this.prisma.bloodRequest.findUnique({
      where: { id },
      include: { hospital: { select: { userId: true } } },
    });
    if (!request) {
      throw new NotFoundException('Blood request not found');
    }
    await this.hospitalAccess.assertHospitalAccess(request.hospitalId, userId, role);

    const oldTrackingStatus = request.trackingStatus;
    const mappedTrackingStatus = this.mapStatusToTracking(dto.status);

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextRequest = await tx.bloodRequest.update({
        where: { id },
        data: {
          status: dto.status,
          trackingStatus: mappedTrackingStatus,
        },
      });

      await tx.bloodRequestUpdate.create({
        data: {
          bloodRequestId: id,
          updatedById: userId,
          oldStatus: oldTrackingStatus,
          newStatus: mappedTrackingStatus,
          comment: dto.comment ?? `Status moved to ${dto.status}`,
        },
      });

      if (mappedTrackingStatus === RequestProgressStatus.COMPLETED && oldTrackingStatus !== RequestProgressStatus.COMPLETED) {
        await this.applyInventoryCreditForCompletion(
          tx as unknown as PrismaService,
          {
            id: request.id,
            hospitalId: request.hospitalId,
            bloodGroup: request.bloodGroup,
            unitsNeeded: request.unitsNeeded,
          },
          userId,
          `Auto-added from completed request ${request.requestReference}`,
        );
      }

      return nextRequest;
    });

    await this.audit.log('BLOOD_REQUEST_STATUS_UPDATED', 'BLOOD_REQUEST', userId, id, {
      ...dto,
      requestReference: request.requestReference,
    });
    await this.realtime.broadcastEmergencyRequest({
      requestId: id,
      requestReference: request.requestReference,
      status: updated.status,
      trackingStatus: updated.trackingStatus,
      changedBy: userId,
      hospitalId: request.hospitalId,
    }, {
      requestId: id,
      hospitalId: request.hospitalId,
      isPublicEmergency: request.type === 'EMERGENCY',
    });
    return updated;
  }

  async listUpdates(id: string, userId: string, role: Role, query: PaginationQueryDto) {
    const skip = query.skip ?? 0;
    const take = query.take ?? 100;
    await this.getById(id, userId, role);
    return this.prisma.bloodRequestUpdate.findMany({
      where: { bloodRequestId: id },
      include: { updatedBy: { select: { email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  async createUpdate(id: string, userId: string, role: Role, dto: CreateBloodRequestUpdateDto) {
    const request = await this.prisma.bloodRequest.findUnique({
      where: { id },
      include: { hospital: { select: { userId: true } } },
    });
    if (!request) {
      throw new NotFoundException('Blood request not found');
    }
    await this.hospitalAccess.assertHospitalAccess(request.hospitalId, userId, role);

    if (request.trackingStatus === dto.newStatus) {
      throw new BadRequestException('Tracking status is already set to this value');
    }

    if (dto.newStatus === RequestProgressStatus.COMPLETED) {
      if (role !== Role.HOSPITAL_STAFF) {
        throw new BadRequestException('Only hospital staff can mark request as COMPLETED. Admin may use completion correction.');
      }
      if (!dto.transfusedByStaffId || !dto.unitDin || !dto.patientEncounterId) {
        throw new BadRequestException(
          'COMPLETED update requires transfusedByStaffId, unitDin, and patientEncounterId.',
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextRequest = await tx.bloodRequest.update({
        where: { id },
        data: { trackingStatus: dto.newStatus },
      });

      const entry = await tx.bloodRequestUpdate.create({
        data: {
          bloodRequestId: id,
          updatedById: userId,
          oldStatus: request.trackingStatus,
          newStatus: dto.newStatus,
          comment: dto.comment,
          transfusedByStaffId: dto.transfusedByStaffId,
          unitDin: dto.unitDin,
          patientEncounterId: dto.patientEncounterId,
        },
        include: { updatedBy: { select: { email: true, role: true } } },
      });

      if (dto.newStatus === RequestProgressStatus.COMPLETED) {
        await this.applyInventoryCreditForCompletion(
          tx as unknown as PrismaService,
          {
            id: request.id,
            hospitalId: request.hospitalId,
            bloodGroup: request.bloodGroup,
            unitsNeeded: request.unitsNeeded,
          },
          userId,
          `Auto-added from completed request ${request.requestReference}`,
        );
      }

      return { nextRequest, entry };
    });

    await this.audit.log('BLOOD_REQUEST_TRACKING_UPDATED', 'BLOOD_REQUEST', userId, id, {
      oldStatus: request.trackingStatus,
      newStatus: dto.newStatus,
      requestReference: request.requestReference,
      comment: dto.comment,
      transfusedByStaffId: dto.transfusedByStaffId,
      unitDin: dto.unitDin,
      patientEncounterId: dto.patientEncounterId,
    });

    await this.realtime.broadcastEmergencyRequest({
      requestId: id,
      requestReference: request.requestReference,
      trackingStatus: dto.newStatus,
      changedBy: userId,
      comment: dto.comment ?? null,
      hospitalId: request.hospitalId,
    }, {
      requestId: id,
      hospitalId: request.hospitalId,
      isPublicEmergency: request.type === 'EMERGENCY',
    });

    return {
      request: updated.nextRequest,
      update: updated.entry,
    };
  }

  async adminCorrectCompletion(id: string, adminUserId: string, dto: AdminCorrectCompletionDto) {
    const request = await this.prisma.bloodRequest.findUnique({ where: { id } });
    if (!request) {
      throw new NotFoundException('Blood request not found');
    }
    if (request.trackingStatus !== RequestProgressStatus.COMPLETED) {
      throw new BadRequestException('Completion correction is allowed only when tracking status is COMPLETED.');
    }

    const entry = await this.prisma.bloodRequestUpdate.create({
      data: {
        bloodRequestId: id,
        updatedById: adminUserId,
        oldStatus: RequestProgressStatus.COMPLETED,
        newStatus: RequestProgressStatus.COMPLETED,
        comment: 'Admin completion correction',
        transfusedByStaffId: dto.transfusedByStaffId,
        unitDin: dto.unitDin,
        patientEncounterId: dto.patientEncounterId,
        overrideReason: dto.overrideReason,
      },
      include: { updatedBy: { select: { email: true, role: true } } },
    });

    await this.audit.log('BLOOD_REQUEST_COMPLETION_CORRECTED_BY_ADMIN', 'BLOOD_REQUEST', adminUserId, id, dto);

    return { message: 'Completion evidence corrected by admin.', update: entry };
  }

  async runEscalationCheck(userId: string, role: Role) {
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const sixMinutesAgo = new Date(now.getTime() - 6 * 60 * 1000);
    const threeMinutesAgo = new Date(now.getTime() - 3 * 60 * 1000);

    const whereScope =
      role === Role.ADMIN || role === Role.SUPER_ADMIN
        ? {}
        : {
            hospital: {
              OR: [{ userId }, { staffMembers: { some: { userId } } }],
            },
          };

    const openRequests = await this.prisma.bloodRequest.findMany({
      where: {
        ...whereScope,
        status: { in: [RequestStatus.OPEN, RequestStatus.MATCHING] },
        createdAt: { gte: tenMinutesAgo },
      },
      include: {
        donorResponses: true,
        hospital: { select: { hospitalName: true, id: true } },
      },
    });

    let remindersTriggered = 0;
    let escalationsTriggered = 0;

    for (const request of openRequests) {
      const hasAccepted = request.donorResponses.some(
        (r) => r.responseStatus === DonorResponseStatus.ACCEPTED || r.responseStatus === DonorResponseStatus.DONATED,
      );
      if (hasAccepted) {
        continue;
      }

      if (request.createdAt <= tenMinutesAgo) {
        escalationsTriggered += 1;
        await this.alerts.notifyCritical('REQUEST_AUTO_ESCALATED', {
          requestId: request.id,
          hospitalId: request.hospitalId,
          hospitalName: request.hospital.hospitalName,
          elapsedMinutes: 10,
        });
        await this.audit.log('REQUEST_AUTO_ESCALATED', 'BLOOD_REQUEST', userId, request.id, {
          elapsedMinutes: 10,
          reason: 'No accepted donor response in 10 minutes',
        });
        continue;
      }

      if (request.createdAt <= sixMinutesAgo) {
        remindersTriggered += 1;
      } else if (request.createdAt <= threeMinutesAgo) {
        remindersTriggered += 1;
      }
    }

    return {
      scanned: openRequests.length,
      remindersTriggered,
      escalationsTriggered,
    };
  }

  async listDonorResponses(id: string, userId: string, role: Role, query: PaginationQueryDto) {
    const skip = query.skip ?? 0;
    const take = query.take ?? 100;
    await this.getById(id, userId, role);
    return this.prisma.donorResponse.findMany({
      where: { bloodRequestId: id },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: {
        donor: {
          select: {
            id: true,
            fullName: true,
            bloodGroup: true,
            location: true,
            user: { select: { email: true } },
          },
        },
      },
    });
  }

  async respondToRequest(id: string, userId: string, dto: RespondToBloodRequestDto) {
    switch (dto.responseStatus) {
      case DonorResponseStatus.ACCEPTED:
      case DonorResponseStatus.DECLINED:
      case DonorResponseStatus.DONATED:
        break;
      default:
        throw new BadRequestException('Invalid response status for donor');
    }

    const donor = await this.prisma.donor.findUnique({
      where: { userId },
      include: {
        clinicalRecords: {
          select: { status: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!donor) {
      throw new NotFoundException('Donor profile not found');
    }

    const request = await this.prisma.bloodRequest.findUnique({
      where: { id },
      include: { matchedDonors: { select: { id: true } } },
    });
    if (!request) {
      throw new NotFoundException('Blood request not found');
    }

    if (!this.isActiveRequestStatus(request.status)) {
      throw new BadRequestException('This request is no longer active.');
    }

    if (request.requestSource === RequestSource.HOSPITALS_ONLY) {
      throw new BadRequestException('This request is not accepting donor responses.');
    }

    const donorMatched = request.matchedDonors.some((item) => item.id === donor.id);
    if (!donorMatched) {
      throw new BadRequestException('You are not matched to this request');
    }

    const latestClinicalStatus = donor.clinicalRecords[0]?.status ?? null;
    const donorBlockingClinicalStatuses: DonorClinicalStatus[] = [
        DonorClinicalStatus.REJECTED,
        DonorClinicalStatus.TEMPORARILY_DEFERRED,
        DonorClinicalStatus.PERMANENTLY_DEFERRED,
    ];
    const hasDeferredRecord = donor.clinicalRecords.some((record) => donorBlockingClinicalStatuses.includes(record.status));
    if (
      donor.bloodGroup === BloodGroup.UNKNOWN ||
      !donor.eligibilityStatus ||
      !donor.availabilityStatus ||
      hasDeferredRecord ||
      latestClinicalStatus !== DonorClinicalStatus.APPROVED
    ) {
      throw new BadRequestException('You are not currently eligible to respond to this emergency request.');
    }

    if (donor.nextEligibilityDate && donor.nextEligibilityDate > new Date()) {
      throw new BadRequestException('You are still in donation cooldown and cannot respond to this request.');
    }

    const response = await this.prisma.donorResponse.upsert({
      where: {
        bloodRequestId_donorId: {
          bloodRequestId: id,
          donorId: donor.id,
        },
      },
      update: {
        responseStatus: dto.responseStatus,
        notes: dto.notes,
        responseTime: new Date(),
      },
      create: {
        bloodRequestId: id,
        donorId: donor.id,
        responseStatus: dto.responseStatus,
        notes: dto.notes,
        responseTime: new Date(),
      },
      include: {
        donor: {
          select: {
            id: true,
            fullName: true,
            bloodGroup: true,
            location: true,
            user: { select: { email: true } },
          },
        },
      },
    });

    if (dto.responseStatus === DonorResponseStatus.ACCEPTED || dto.responseStatus === DonorResponseStatus.DONATED) {
      const newTrackingStatus =
        dto.responseStatus === DonorResponseStatus.ACCEPTED
          ? RequestProgressStatus.MATCHED
          : RequestProgressStatus.IN_PROGRESS;

      if (request.trackingStatus !== newTrackingStatus) {
        await this.prisma.$transaction(async (tx) => {
          await tx.bloodRequest.update({
            where: { id },
            data: { trackingStatus: newTrackingStatus },
          });

          await tx.bloodRequestUpdate.create({
            data: {
              bloodRequestId: id,
              updatedById: userId,
              oldStatus: request.trackingStatus,
              newStatus: newTrackingStatus,
              comment: `Donor ${dto.responseStatus.toLowerCase()} request`,
            },
          });
        });
      }
    }

    await this.audit.log('DONOR_RESPONSE_SUBMITTED', 'DONOR_RESPONSE', userId, response.id, {
      bloodRequestId: id,
      responseStatus: dto.responseStatus,
    });

    this.realtime.broadcastDonorResponse({
      responseId: response.id,
      bloodRequestId: id,
      donorId: donor.id,
      responseStatus: response.responseStatus,
    });

    return response;
  }

  async updateDonorResponse(responseId: string, userId: string, role: Role, dto: UpdateDonorResponseDto) {
    const response = await this.prisma.donorResponse.findUnique({
      where: { id: responseId },
      include: {
        bloodRequest: { include: { hospital: { select: { userId: true } } } },
      },
    });

    if (!response) {
      throw new NotFoundException('Donor response not found');
    }

    const canHospitalUpdateResponse = role === Role.HOSPITAL_STAFF || role === Role.BLOOD_BANK_OFFICER;
    if (canHospitalUpdateResponse) {
      await this.hospitalAccess.assertHospitalAccess(response.bloodRequest.hospitalId, userId, role);
    }

    const updatePayload: { responseStatus?: DonorResponseStatus; notes?: string; responseTime?: Date } = {};
    if (dto.responseStatus) {
      updatePayload.responseStatus = dto.responseStatus;
      updatePayload.responseTime = new Date();
    }
    if (dto.notes !== undefined) {
      updatePayload.notes = dto.notes;
    }
    if (!updatePayload.responseStatus && updatePayload.notes === undefined) {
      throw new BadRequestException('No donor response changes provided');
    }

    const updated = await this.prisma.donorResponse.update({
      where: { id: responseId },
      data: updatePayload,
      include: {
        donor: {
          select: {
            id: true,
            fullName: true,
            bloodGroup: true,
            location: true,
            user: { select: { email: true } },
          },
        },
      },
    });

    await this.audit.log('DONOR_RESPONSE_UPDATED', 'DONOR_RESPONSE', userId, responseId, dto);
    this.realtime.broadcastDonorResponse({
      responseId: updated.id,
      bloodRequestId: response.bloodRequestId,
      donorId: updated.donor.id,
      responseStatus: updated.responseStatus,
      updatedBy: userId,
    });
    return updated;
  }
}

