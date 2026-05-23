import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BloodGroup,
  DonorClinicalStatus,
  DonorResponseStatus,
  InventoryChangeType,
  NotificationType,
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

  async create(userId: string, dto: CreateBloodRequestDto) {
    const hospital = await this.hospitalAccess.getHospitalForUser(userId);

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
      if (!dto.ward?.trim()) throw new BadRequestException('ward is required for emergency requests');
      if (!dto.city?.trim()) throw new BadRequestException('city is required for emergency requests');
      if (!dto.region?.trim()) throw new BadRequestException('region is required for emergency requests');
      if (typeof dto.latitude !== 'number' || typeof dto.longitude !== 'number') {
        throw new BadRequestException('latitude and longitude are required for emergency requests');
      }
    }

    const baseMatchedDonors = await this.prisma.donor.findMany({
      where: {
        bloodGroup: { in: compatibleGroups },
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
    });

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

    if (matchedDonors.length < dto.unitsNeeded && dto.type === 'EMERGENCY') {
      this.alerts.notifyCritical('LOW_MATCH_COVERAGE', {
        requestLocation: normalizedLocation,
        bloodGroup: dto.bloodGroup,
        unitsNeeded: dto.unitsNeeded,
        matchedDonors: matchedDonors.length,
      });
    }

    const request = await this.prisma.bloodRequest.create({
      data: {
        hospitalId: hospital.id,
        patientName: dto.patientName,
        patientCode: dto.patientCode,
        bloodGroup: dto.bloodGroup,
        unitsNeeded: dto.unitsNeeded,
        type: dto.type,
        priority: dto.priority,
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

    if (dto.type === 'EMERGENCY') {
      this.alerts.notifyCritical('EMERGENCY_REQUEST_CREATED', {
        requestId: request.id,
        bloodGroup: request.bloodGroup,
        city: dto.city ?? null,
        region: dto.region ?? null,
        ward: dto.ward ?? null,
      });
    }

    await this.audit.log('BLOOD_REQUEST_CREATED', 'BLOOD_REQUEST', userId, request.id, {
      matchedDonorCount: matchedDonors.length,
      matchingRadiusKm: radiusKm,
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

    if (matchedDonors.length > 0) {
      await this.prisma.donorResponse.createMany({
        data: matchedDonors.map((donor) => ({
          bloodRequestId: request.id,
          donorId: donor.id,
          responseStatus: DonorResponseStatus.PENDING,
        })),
        skipDuplicates: true,
      });
    }

    await Promise.all(
      matchedDonors.map((donor) =>
        this.notifications.createAndBroadcastNotification({
          userId: donor.userId,
          bloodRequestId: request.id,
          title: `${dto.priority === 'CRITICAL' ? 'Critical' : 'Urgent'} ${dto.bloodGroup} blood request`,
          body: [
            `${hospital.hospitalName} needs ${dto.unitsNeeded} units (${dto.bloodGroup}).`,
            `Urgency: ${dto.priority}.`,
            `Required by: ${requiredByDate.toLocaleString()}.`,
            donor.distanceKm !== null ? `Distance: ${donor.distanceKm.toFixed(1)} km.` : null,
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

    if (process.env.SMS_ENABLED === 'true' && matchedDonors.length > 0) {
      await this.audit.log('EMERGENCY_SMS_DISPATCH_TRIGGERED', 'BLOOD_REQUEST', userId, request.id, {
        matchedDonorCount: matchedDonors.length,
      });
      this.alerts.notifyCritical('EMERGENCY_SMS_DISPATCH_TRIGGERED', {
        requestId: request.id,
        matchedDonorCount: matchedDonors.length,
      });
    }

    await this.audit.log('REQUEST_SLA_INITIALIZED', 'BLOOD_REQUEST', userId, request.id, {
      reminderMinutes: [3, 6],
      escalationMinutes: 10,
      matchedDonorCount: matchedDonors.length,
      matchingRadiusKm: radiusKm,
    });

    this.realtime.broadcastEmergencyRequest({
      requestId: request.id,
      status: request.status,
      trackingStatus: request.trackingStatus,
      bloodGroup: request.bloodGroup,
      unitsNeeded: request.unitsNeeded,
      priority: request.priority,
      location: request.location,
      emergencyLocation: request.emergencyLocation,
      city: request.city,
      region: request.region,
      ward: request.ward,
      latitude: request.latitude,
      longitude: request.longitude,
      hospitalId: request.hospitalId,
      matchedDonorCount: matchedDonors.length,
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
          include: { donor: { select: { id: true, fullName: true, bloodGroup: true, location: true, user: { select: { email: true } } } } },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Blood request not found');
    }

    if (
      role === Role.HOSPITAL_ADMIN ||
      role === Role.HOSPITAL_STAFF ||
      role === Role.INVENTORY_OFFICER ||
      role === Role.DONOR_REVIEW_OFFICER
    ) {
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
          `Auto-added from completed request ${request.id}`,
        );
      }

      return nextRequest;
    });

    await this.audit.log('BLOOD_REQUEST_STATUS_UPDATED', 'BLOOD_REQUEST', userId, id, dto);
    this.realtime.broadcastEmergencyRequest({
      requestId: id,
      status: updated.status,
      trackingStatus: updated.trackingStatus,
      changedBy: userId,
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
      if (role !== Role.HOSPITAL_STAFF && role !== Role.HOSPITAL_ADMIN) {
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
          `Auto-added from completed request ${request.id}`,
        );
      }

      return { nextRequest, entry };
    });

    await this.audit.log('BLOOD_REQUEST_TRACKING_UPDATED', 'BLOOD_REQUEST', userId, id, {
      oldStatus: request.trackingStatus,
      newStatus: dto.newStatus,
      comment: dto.comment,
      transfusedByStaffId: dto.transfusedByStaffId,
      unitDin: dto.unitDin,
      patientEncounterId: dto.patientEncounterId,
    });

    this.realtime.broadcastEmergencyRequest({
      requestId: id,
      trackingStatus: dto.newStatus,
      changedBy: userId,
      comment: dto.comment ?? null,
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

    const donor = await this.prisma.donor.findUnique({ where: { userId } });
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

    const donorMatched = request.matchedDonors.some((item) => item.id === donor.id);
    if (!donorMatched) {
      throw new BadRequestException('You are not matched to this request');
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

    if (
      role === Role.HOSPITAL_ADMIN ||
      role === Role.HOSPITAL_STAFF ||
      role === Role.DONOR_REVIEW_OFFICER
    ) {
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
