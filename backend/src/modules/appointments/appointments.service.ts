import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
import { AuditService } from '../../common/audit/audit.service';
import { CreateHospitalAppointmentDto } from './dto/create-hospital-appointment.dto';
import { DeclineAppointmentDto } from './dto/decline-appointment.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { RequestAppointmentRescheduleDto } from './dto/request-appointment-reschedule.dto';
import { HospitalAccessService } from '../../common/rbac/hospital-access.service';
import { RealtimeService } from '../../common/realtime/realtime.service';
import { AppointmentQueryDto } from './dto/appointment-query.dto';
import {
  AppointmentStatus,
  AppointmentType,
  BloodGroup,
  DonorClinicalStatus,
  InventoryChangeType,
  NotificationType,
  Prisma,
  Role,
  SmsPurpose,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { SmsService } from '../sms/sms.service';

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly hospitalAccess: HospitalAccessService,
    private readonly notifications: NotificationsService,
    private readonly smsService: SmsService,
    private readonly realtime: RealtimeService,
  ) {}

  private readonly todayAppointmentStatuses = [
    AppointmentStatus.SCHEDULED,
    AppointmentStatus.PENDING_CONFIRMATION,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.DONOR_ARRIVED,
    AppointmentStatus.IN_PROGRESS,
    AppointmentStatus.RESCHEDULE_REQUESTED,
    AppointmentStatus.RESCHEDULED,
    AppointmentStatus.DECLINED,
    AppointmentStatus.COMPLETED,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.MISSED,
    AppointmentStatus.NO_SHOW,
  ];

  private appointmentTypeLabel(type: AppointmentType) {
    const labels: Record<AppointmentType, string> = {
      BLOOD_DONATION: 'Blood Donation',
      ELIGIBILITY_SCREENING: 'Eligibility Screening',
      FOLLOW_UP: 'Follow-Up',
      EMERGENCY_DONATION: 'Emergency Donation',
    };
    return labels[type];
  }

  private addMonths(date: Date, months: number) {
    const next = new Date(date);
    next.setMonth(next.getMonth() + months);
    return next;
  }

  private appointmentInclude: Prisma.AppointmentInclude = {
    donor: true,
    hospital: true,
    bloodRequest: { select: { requestReference: true } },
  };

  private toLocalDateString(date: Date, timezoneOffsetMinutes: number) {
    const localTime = date.getTime() - timezoneOffsetMinutes * 60_000;
    return new Date(localTime).toISOString().slice(0, 10);
  }

  private getLocalDayRange(query: AppointmentQueryDto) {
    if (query.dateFilter !== 'today') {
      return null;
    }

    const timezoneOffsetMinutes = query.timezoneOffsetMinutes ?? 0;
    const localDate = query.localDate ?? this.toLocalDateString(new Date(), timezoneOffsetMinutes);
    const [year, month, day] = localDate.split('-').map(Number);
    if (!year || !month || !day) {
      throw new BadRequestException('Invalid local appointment date.');
    }

    const start = new Date(Date.UTC(year, month - 1, day) + timezoneOffsetMinutes * 60_000);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { start, end };
  }

  private withAppointmentQuery(where: Prisma.AppointmentWhereInput, query: AppointmentQueryDto) {
    const dayRange = this.getLocalDayRange(query);
    if (!dayRange) {
      return where;
    }

    return {
      ...where,
      scheduledAt: { gte: dayRange.start, lt: dayRange.end },
      status: { in: this.todayAppointmentStatuses },
    };
  }

  private async whereForUser(userId: string, role: Role, query: AppointmentQueryDto) {
    if (role === Role.ADMIN) {
      return this.withAppointmentQuery({}, query);
    }

    if (role === Role.DONOR) {
      return this.withAppointmentQuery({ donor: { userId } }, query);
    }

    const hospital = await this.hospitalAccess.getHospitalForUser(userId);
    return this.withAppointmentQuery({ hospitalId: hospital.id }, query);
  }

  private async broadcastAppointmentChanged(appointment: { id: string; hospitalId: string; status: AppointmentStatus; scheduledAt: Date }) {
    await this.realtime.broadcastAppointmentUpdate({
      appointmentId: appointment.id,
      hospitalId: appointment.hospitalId,
      status: appointment.status,
      scheduledAt: appointment.scheduledAt.toISOString(),
    }, appointment.hospitalId);
  }

  private async notifyAppointmentParticipants(appointment: {
    id: string;
    appointmentReference: string;
    scheduledAt: Date;
    appointmentType: AppointmentType;
    donor: { userId: string; fullName: string; phone?: string | null; alternativePhoneNumber?: string | null; notificationSmsEnabled?: boolean };
    hospital: { userId: string; hospitalName: string; contactPhone?: string | null };
  }, title: string, body: string, smsPurpose: SmsPurpose = SmsPurpose.APPOINTMENT_CREATED) {
    await Promise.all([
      this.notifications.createAndBroadcastNotification({
        userId: appointment.donor.userId,
        title,
        body,
        channel: 'IN_APP',
        type: NotificationType.APPOINTMENT,
        delivered: true,
      }),
      this.notifications.createAndBroadcastNotification({
        userId: appointment.hospital.userId,
        title,
        body,
        channel: 'IN_APP',
        type: NotificationType.APPOINTMENT,
        delivered: true,
      }),
    ]);

    const smsRecipients = [
      appointment.donor.notificationSmsEnabled ? appointment.donor.phone ?? appointment.donor.alternativePhoneNumber : null,
      appointment.hospital.contactPhone ?? null,
    ];
    await this.smsService.sendAppointmentNotification({
      recipients: smsRecipients,
      message: `BloodSOS: ${body}`.slice(0, 300),
      purpose: smsPurpose,
      relatedEntityType: 'APPOINTMENT',
      relatedEntityId: appointment.id,
      idempotencyKey: this.smsService.buildEventIdempotencyKey(
        smsPurpose,
        'APPOINTMENT',
        appointment.id,
        title,
        smsRecipients.filter((recipient): recipient is string => Boolean(recipient)),
      ),
    });
  }

  private async getOwnedDonorAppointment(id: string, userId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        donor: { select: { id: true, userId: true, fullName: true, phone: true, alternativePhoneNumber: true, notificationSmsEnabled: true } },
        hospital: { select: { id: true, userId: true, hospitalName: true, location: true, contactPhone: true } },
        bloodRequest: { select: { requestReference: true } },
      },
    });
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }
    if (appointment.donor.userId !== userId) {
      throw new ForbiddenException('Only the appointment owner can respond to this appointment.');
    }
    return appointment;
  }

  private canCompleteAppointment(status: AppointmentStatus) {
    return new Set<AppointmentStatus>([
      AppointmentStatus.SCHEDULED,
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.DONOR_ARRIVED,
      AppointmentStatus.IN_PROGRESS,
    ]).has(status);
  }

  private deriveHospitalCode(hospitalName?: string | null, registrationCode?: string | null) {
    const words = (hospitalName ?? '')
      .split(/\s+/)
      .map((word) => word.replace(/[^a-z0-9]/gi, ''))
      .filter((word) => word && !/^(and|of|the)$/i.test(word));
    const acronym = words.map((word) => word[0]).join('').toUpperCase();
    const fallback = (registrationCode ?? 'HOSP').replace(/[^a-z0-9]/gi, '').toUpperCase();
    return (acronym || fallback || 'HOSP').slice(0, 8);
  }

  private isUniqueConstraint(error: unknown, field: string) {
    return error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === 'P2002'
      && (Array.isArray(error.meta?.target)
        ? error.meta.target.includes(field)
        : String(error.meta?.target ?? '').includes(field));
  }

  private async getOrCreateHospitalCode(
    tx: Prisma.TransactionClient,
    hospital: { id: string; hospitalName?: string | null; registrationCode?: string | null; hospitalCode?: string | null },
  ) {
    if (hospital.hospitalCode) {
      return hospital.hospitalCode;
    }

    const baseCode = this.deriveHospitalCode(hospital.hospitalName, hospital.registrationCode);
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const candidate = attempt === 0 ? baseCode : `${baseCode}${attempt + 1}`;
      try {
        const updated = await tx.hospital.update({
          where: { id: hospital.id },
          data: { hospitalCode: candidate },
          select: { hospitalCode: true },
        });
        return updated.hospitalCode ?? candidate;
      } catch (error) {
        if (!this.isUniqueConstraint(error, 'hospitalCode') || attempt === 24) {
          throw error;
        }
      }
    }

    throw new BadRequestException('Unable to generate a hospital code for donation numbering.');
  }

  private async generateDonationNumber(
    tx: Prisma.TransactionClient,
    hospitalId: string,
    hospitalCode: string,
    donationDate: Date,
    sequenceOffset = 0,
  ) {
    const year = donationDate.getFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const nextYearStart = new Date(Date.UTC(year + 1, 0, 1));
    const existingThisYear = await tx.donation.count({
      where: {
        hospitalId,
        donatedAt: { gte: yearStart, lt: nextYearStart },
      },
    });

    let sequence = existingThisYear + 1 + sequenceOffset;
    while (sequence < existingThisYear + 1000) {
      const candidate = `DON-${hospitalCode}-${year}-${String(sequence).padStart(5, '0')}`;
      const existing = await tx.donation.findUnique({
        where: { donationNumber: candidate },
        select: { id: true },
      });
      if (!existing) {
        return candidate;
      }
      sequence += 1;
    }

    throw new BadRequestException('Unable to generate a unique donation number. Please try again.');
  }

  private async generateAppointmentReference(sequenceOffset = 0) {
    const year = new Date().getFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const nextYearStart = new Date(Date.UTC(year + 1, 0, 1));
    const existingThisYear = await this.prisma.appointment.count({
      where: {
        createdAt: { gte: yearStart, lt: nextYearStart },
      },
    });

    let sequence = existingThisYear + 1 + sequenceOffset;
    while (sequence < existingThisYear + 1000) {
      const candidate = `APT-${year}-${String(sequence).padStart(5, '0')}`;
      const existing = await this.prisma.appointment.findUnique({
        where: { appointmentReference: candidate },
        select: { id: true },
      });
      if (!existing) {
        return candidate;
      }
      sequence += 1;
    }

    throw new BadRequestException('Unable to generate a unique appointment reference. Please try again.');
  }

  private async createAppointmentWithReference(
    data: Omit<Prisma.AppointmentCreateInput, 'appointmentReference'>,
    include?: Prisma.AppointmentInclude,
  ) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const appointmentReference = await this.generateAppointmentReference(attempt);
      try {
        return await this.prisma.appointment.create({
          data: { ...data, appointmentReference },
          include,
        });
      } catch (error) {
        const isReferenceCollision =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          (Array.isArray(error.meta?.target)
            ? error.meta.target.includes('appointmentReference')
            : String(error.meta?.target ?? '').includes('appointmentReference'));
        if (!isReferenceCollision || attempt === 4) {
          throw error;
        }
      }
    }

    throw new BadRequestException('Unable to create appointment. Please try again.');
  }

  private eligibleDonorWhere(search?: string) {
    const term = search?.trim();
    return {
      availabilityStatus: true,
      eligibilityStatus: true,
      bloodGroup: { not: 'UNKNOWN' as const },
      OR: [
        { nextEligibilityDate: null },
        { nextEligibilityDate: { lte: new Date() } },
      ],
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
      ...(term
        ? {
            AND: [{
              OR: [
              { fullName: { contains: term, mode: 'insensitive' as const } },
              { firstName: { contains: term, mode: 'insensitive' as const } },
              { otherNames: { contains: term, mode: 'insensitive' as const } },
              { surname: { contains: term, mode: 'insensitive' as const } },
              { donorNumber: { contains: term, mode: 'insensitive' as const } },
              { location: { contains: term, mode: 'insensitive' as const } },
              ],
            }],
          }
        : {}),
    };
  }

  private assertDonorCanAttendDonation(donor: { nextEligibilityDate?: Date | null }, scheduledAt: Date) {
    if (donor.nextEligibilityDate && scheduledAt < donor.nextEligibilityDate) {
      throw new BadRequestException(
        `This donor is in donation cooldown until ${donor.nextEligibilityDate.toLocaleDateString()}. Schedule donation appointments after this date.`,
      );
    }
  }

  async create(userId: string, dto: CreateAppointmentDto) {
    const donor = await this.prisma.donor.findUnique({ where: { userId } });
    if (!donor) {
      throw new NotFoundException('Donor profile not found');
    }
    const scheduledAt = new Date(dto.scheduledAt);
    if ((dto.appointmentType ?? AppointmentType.BLOOD_DONATION) === AppointmentType.BLOOD_DONATION) {
      this.assertDonorCanAttendDonation(donor, scheduledAt);
    }

    const appointment = await this.createAppointmentWithReference({
      donor: { connect: { id: donor.id } },
      hospital: { connect: { id: dto.hospitalId } },
      scheduledAt,
      appointmentType: dto.appointmentType ?? AppointmentType.BLOOD_DONATION,
      notes: dto.notes,
    });

    await this.audit.log('APPOINTMENT_CREATED', 'APPOINTMENT', userId, appointment.id, {
      ...dto,
      appointmentReference: appointment.appointmentReference,
    });
    await this.broadcastAppointmentChanged(appointment);
    return appointment;
  }

  async createByHospital(userId: string, dto: CreateHospitalAppointmentDto) {
    const hospital = await this.hospitalAccess.getHospitalForUser(userId);

    const scheduledAt = new Date(dto.scheduledAt);
    const donor = await this.prisma.donor.findFirst({
      where: {
        id: dto.donorId,
        ...this.eligibleDonorWhere(),
      },
      include: {
        user: { select: { id: true } },
        donationHistory: { orderBy: { donatedAt: 'desc' }, take: 1, select: { donatedAt: true } },
      },
    });
    if (!donor) {
      throw new NotFoundException('Approved active donor not found');
    }
    if ((dto.appointmentType ?? AppointmentType.BLOOD_DONATION) === AppointmentType.BLOOD_DONATION) {
      this.assertDonorCanAttendDonation(donor, scheduledAt);
    }

    if (dto.bloodRequestId) {
      const request = await this.prisma.bloodRequest.findUnique({ where: { id: dto.bloodRequestId } });
      if (!request || request.hospitalId !== hospital.id) {
        throw new BadRequestException('Blood request is not available for this hospital appointment.');
      }
    }

    const appointment = await this.createAppointmentWithReference(
      {
        donor: { connect: { id: donor.id } },
        hospital: { connect: { id: hospital.id } },
        ...(dto.bloodRequestId ? { bloodRequest: { connect: { id: dto.bloodRequestId } } } : {}),
        scheduledAt,
        appointmentType: dto.appointmentType ?? AppointmentType.BLOOD_DONATION,
        status: AppointmentStatus.PENDING_CONFIRMATION,
        notes: dto.notes,
      },
      {
        donor: { select: { id: true, donorNumber: true, fullName: true, firstName: true, otherNames: true, surname: true, bloodGroup: true, location: true } },
        bloodRequest: { select: { id: true, requestReference: true } },
      },
    );

    await this.notifications.createAndBroadcastNotification({
      userId: donor.user.id,
      bloodRequestId: dto.bloodRequestId,
      title: `${this.appointmentTypeLabel(appointment.appointmentType)} appointment scheduled`,
      body: [
        `Appointment ${appointment.appointmentReference} has been scheduled.`,
        `${hospital.hospitalName} scheduled a ${this.appointmentTypeLabel(appointment.appointmentType)} appointment.`,
        `Date and time: ${appointment.scheduledAt.toLocaleString()}.`,
        dto.notes ? `Notes: ${dto.notes}` : null,
      ].filter(Boolean).join(' '),
      channel: 'IN_APP',
      type: NotificationType.APPOINTMENT,
      delivered: true,
    });

    const createdSmsRecipients = [
      donor.notificationSmsEnabled ? donor.phone ?? donor.alternativePhoneNumber : null,
      hospital.contactPhone ?? null,
    ];
    await this.smsService.sendAppointmentNotification({
      recipients: createdSmsRecipients,
      message: `BloodSOS: ${hospital.hospitalName} proposed a blood donation appointment for ${appointment.scheduledAt.toLocaleDateString()} at ${appointment.scheduledAt.toLocaleTimeString()}. Log in to accept, decline, or request another time.`,
      purpose: SmsPurpose.APPOINTMENT_CREATED,
      hospitalId: hospital.id,
      triggeredByUserId: userId,
      relatedEntityType: 'APPOINTMENT',
      relatedEntityId: appointment.id,
      idempotencyKey: this.smsService.buildEventIdempotencyKey(
        SmsPurpose.APPOINTMENT_CREATED,
        'APPOINTMENT',
        appointment.id,
        'PENDING_CONFIRMATION',
        createdSmsRecipients.filter((recipient): recipient is string => Boolean(recipient)),
      ),
    });

    await this.audit.log('APPOINTMENT_CREATED_BY_HOSPITAL', 'APPOINTMENT', userId, appointment.id, {
      ...dto,
      appointmentReference: appointment.appointmentReference,
    });
    await this.broadcastAppointmentChanged(appointment);
    return appointment;
  }

  async listEligibleDonors(userId: string, query: PaginationQueryDto & { search?: string }) {
    await this.hospitalAccess.getHospitalForUser(userId);
    const skip = query.skip ?? 0;
    const take = Math.min(query.take ?? 50, 100);

    return this.prisma.donor.findMany({
      where: this.eligibleDonorWhere(query.search),
      orderBy: { fullName: 'asc' },
      skip,
      take,
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
        nextEligibilityDate: true,
        donationHistory: { orderBy: { donatedAt: 'desc' }, take: 1, select: { donatedAt: true } },
      },
    });
  }

  async listForUser(userId: string, role: Role, query: AppointmentQueryDto) {
    const skip = query.skip ?? 0;
    const take = query.take ?? 100;
    const where = await this.whereForUser(userId, role, query);
    return this.prisma.appointment.findMany({
      where,
      include: this.appointmentInclude,
      orderBy: { scheduledAt: 'asc' },
      skip,
      take,
    });
  }

  async summaryForUser(userId: string, role: Role, query: AppointmentQueryDto) {
    const where = await this.whereForUser(userId, role, query);
    const total = await this.prisma.appointment.count({ where });
    return {
      total,
      todayStatusesIncluded: this.todayAppointmentStatuses,
      dateField: 'scheduledAt',
      dateFilter: query.dateFilter ?? null,
      localDate: query.dateFilter === 'today'
        ? query.localDate ?? this.toLocalDateString(new Date(), query.timezoneOffsetMinutes ?? 0)
        : null,
      timezoneOffsetMinutes: query.timezoneOffsetMinutes ?? 0,
    };
  }

  async acceptAppointment(id: string, userId: string) {
    const appointment = await this.getOwnedDonorAppointment(id, userId);
    if (appointment.status !== AppointmentStatus.PENDING_CONFIRMATION) {
      throw new BadRequestException('Only appointments pending confirmation can be accepted.');
    }

    const confirmedAt = new Date();
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.CONFIRMED,
        confirmedAt,
      },
      include: this.appointmentInclude,
    });

    await this.notifyAppointmentParticipants(
      appointment,
      `Appointment accepted: ${appointment.appointmentReference}`,
      `${appointment.donor.fullName} accepted appointment ${appointment.appointmentReference} at ${appointment.hospital.hospitalName}. Date and time: ${appointment.scheduledAt.toLocaleString()}.`,
      SmsPurpose.APPOINTMENT_CREATED,
    );
    await this.audit.log('APPOINTMENT_ACCEPTED_BY_DONOR', 'APPOINTMENT', userId, id, {
      appointmentReference: appointment.appointmentReference,
      confirmedAt,
    });
    await this.broadcastAppointmentChanged(updated);

    return updated;
  }

  async requestReschedule(id: string, userId: string, dto: RequestAppointmentRescheduleDto) {
    const appointment = await this.getOwnedDonorAppointment(id, userId);
    const reschedulableStatuses = new Set<AppointmentStatus>([
      AppointmentStatus.PENDING_CONFIRMATION,
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.RESCHEDULED,
    ]);
    if (!reschedulableStatuses.has(appointment.status)) {
      throw new BadRequestException('This appointment cannot be rescheduled by the donor.');
    }

    const preferredAt = new Date(dto.preferredAt);
    if (Number.isNaN(preferredAt.getTime())) {
      throw new BadRequestException('Preferred appointment date and time is invalid.');
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.RESCHEDULE_REQUESTED,
        reschedulePreferredAt: preferredAt,
        rescheduleReason: dto.reason?.trim() || null,
      },
      include: this.appointmentInclude,
    });

    await this.notifyAppointmentParticipants(
      appointment,
      `Reschedule requested: ${appointment.appointmentReference}`,
      `${appointment.donor.fullName} requested to reschedule appointment ${appointment.appointmentReference}. Current time: ${appointment.scheduledAt.toLocaleString()}. Preferred time: ${preferredAt.toLocaleString()}${dto.reason ? `. Reason: ${dto.reason}` : ''}.`,
      SmsPurpose.APPOINTMENT_RESCHEDULED,
    );
    await this.audit.log('APPOINTMENT_RESCHEDULE_REQUESTED_BY_DONOR', 'APPOINTMENT', userId, id, {
      appointmentReference: appointment.appointmentReference,
      currentScheduledAt: appointment.scheduledAt,
      preferredAt,
      reason: dto.reason ?? null,
    });
    await this.broadcastAppointmentChanged(updated);

    return updated;
  }

  async declineAppointment(id: string, userId: string, dto: DeclineAppointmentDto) {
    const appointment = await this.getOwnedDonorAppointment(id, userId);
    if (appointment.status !== AppointmentStatus.PENDING_CONFIRMATION) {
      throw new BadRequestException('Only appointments pending confirmation can be declined.');
    }

    const declinedAt = new Date();
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.DECLINED,
        declinedAt,
        declineReason: dto.reason,
        declineNotes: dto.notes?.trim() || null,
      },
      include: this.appointmentInclude,
    });

    await this.notifyAppointmentParticipants(
      appointment,
      `Appointment declined: ${appointment.appointmentReference}`,
      `${appointment.donor.fullName} declined appointment ${appointment.appointmentReference}. Reason: ${dto.reason}${dto.notes ? `. Notes: ${dto.notes}` : ''}.`,
      SmsPurpose.APPOINTMENT_CANCELLED,
    );
    await this.audit.log('APPOINTMENT_DECLINED_BY_DONOR', 'APPOINTMENT', userId, id, {
      appointmentReference: appointment.appointmentReference,
      declinedAt,
      reason: dto.reason,
      notes: dto.notes ?? null,
    });
    await this.broadcastAppointmentChanged(updated);

    return updated;
  }

  async cancelAppointmentByDonor(id: string, userId: string) {
    const appointment = await this.getOwnedDonorAppointment(id, userId);
    const closedStatuses = new Set<AppointmentStatus>([
      AppointmentStatus.COMPLETED,
      AppointmentStatus.CANCELLED,
      AppointmentStatus.DECLINED,
      AppointmentStatus.MISSED,
      AppointmentStatus.NO_SHOW,
    ]);
    if (closedStatuses.has(appointment.status)) {
      throw new BadRequestException('This appointment can no longer be cancelled.');
    }

    const cancelledAt = new Date();
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.CANCELLED,
        cancelledAt,
        cancelledBy: 'Donor',
        cancellationReason: 'Cancelled by donor',
      },
      include: this.appointmentInclude,
    });

    await this.notifyAppointmentParticipants(
      appointment,
      `Appointment cancelled: ${appointment.appointmentReference}`,
      `${appointment.donor.fullName} cancelled appointment ${appointment.appointmentReference} at ${appointment.hospital.hospitalName}.`,
      SmsPurpose.APPOINTMENT_CANCELLED,
    );
    await this.audit.log('APPOINTMENT_CANCELLED_BY_DONOR', 'APPOINTMENT', userId, id, {
      appointmentReference: appointment.appointmentReference,
      cancelledAt,
    });
    await this.broadcastAppointmentChanged(updated);

    return updated;
  }

  async previewDonationNumber(id: string, userId: string, role: Role) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        hospital: { select: { id: true, hospitalName: true, registrationCode: true, hospitalCode: true } },
      },
    });
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    await this.hospitalAccess.assertHospitalAccess(appointment.hospitalId, userId, role);
    if (appointment.donationNumber) {
      return { donationNumber: appointment.donationNumber };
    }

    const donationDate = appointment.completedAt ?? appointment.scheduledAt;
    const donationNumber = await this.prisma.$transaction(async (tx) => {
      const hospitalCode = await this.getOrCreateHospitalCode(tx, appointment.hospital);
      return this.generateDonationNumber(tx, appointment.hospitalId, hospitalCode, donationDate);
    });
    return { donationNumber };
  }

  async updateStatus(
    id: string,
    userId: string,
    role: Role,
    dto: UpdateAppointmentStatusDto,
  ) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        donor: true,
        hospital: { select: { id: true, userId: true, hospitalName: true, registrationCode: true, hospitalCode: true, location: true } },
        bloodRequest: { select: { id: true, requestReference: true } },
      },
    });
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    await this.hospitalAccess.assertHospitalAccess(appointment.hospitalId, userId, role);

    const isBloodDonation = appointment.appointmentType === AppointmentType.BLOOD_DONATION;
    const shouldPostDonation = dto.status === AppointmentStatus.COMPLETED && isBloodDonation;
    if (appointment.status === AppointmentStatus.CANCELLED && dto.status === AppointmentStatus.COMPLETED) {
      throw new BadRequestException('Cancelled appointments cannot be completed or posted to inventory.');
    }
    if (appointment.status === AppointmentStatus.DECLINED && dto.status === AppointmentStatus.COMPLETED) {
      throw new BadRequestException('Declined appointments cannot be completed or posted to inventory.');
    }
    if (appointment.status === AppointmentStatus.COMPLETED && dto.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException('Completed appointments cannot be cancelled.');
    }
    if (shouldPostDonation && !this.canCompleteAppointment(appointment.status)) {
      throw new BadRequestException('Donation inventory can only be posted for scheduled, confirmed, donor-arrived, or in-progress appointments.');
    }
    const unitsCollected = Number(dto.unitsCollected ?? appointment.unitsCollected ?? 0);
    const volumeCollectedMl = dto.volumeCollectedMl ?? appointment.volumeCollectedMl ?? 450;

    if (shouldPostDonation && !appointment.donationPostedAt) {
      this.assertDonorCanAttendDonation(appointment.donor, appointment.scheduledAt);
      if (!Number.isFinite(unitsCollected) || unitsCollected <= 0) {
        throw new BadRequestException('Units collected is required before completing a blood donation appointment.');
      }
      if (appointment.donor.bloodGroup === BloodGroup.UNKNOWN) {
        throw new BadRequestException('Confirm donor blood group before posting donation inventory.');
      }
    }

    let updated;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        updated = await this.prisma.$transaction(async (tx) => {
      const completedAt = dto.status === AppointmentStatus.COMPLETED
        ? appointment.completedAt ?? (appointment.status === AppointmentStatus.COMPLETED ? appointment.scheduledAt : new Date())
        : appointment.completedAt;
      const donationDate = completedAt ?? appointment.scheduledAt;
      const hospitalCode = shouldPostDonation && !appointment.donationPostedAt
        ? await this.getOrCreateHospitalCode(tx, appointment.hospital)
        : appointment.hospital.hospitalCode ?? this.deriveHospitalCode(appointment.hospital.hospitalName, appointment.hospital.registrationCode);
      const donationNumber = shouldPostDonation && !appointment.donationPostedAt
        ? await this.generateDonationNumber(tx, appointment.hospitalId, hospitalCode, donationDate, attempt)
        : appointment.donationNumber;

      const base = await tx.appointment.update({
        where: { id },
        data: {
          status: dto.status,
          completedAt,
          ...(dto.status === AppointmentStatus.CONFIRMED ? { confirmedAt: new Date() } : {}),
          ...(dto.status === AppointmentStatus.CANCELLED ? { cancelledAt: new Date(), cancelledBy: 'Hospital Admin', cancellationReason: dto.donationNotes?.trim() || 'Cancelled by hospital' } : {}),
          ...(shouldPostDonation ? {
            unitsCollected,
            volumeCollectedMl,
            donationNumber: donationNumber ?? appointment.donationNumber,
            donationNotes: dto.donationNotes?.trim() || appointment.donationNotes,
          } : {}),
        },
      });

      if (!shouldPostDonation || base.donationPostedAt) {
        return base;
      }

      const postedAt = new Date();
      const claimed = await tx.appointment.updateMany({
        where: { id, donationPostedAt: null },
        data: { donationPostedAt: postedAt },
      });
      if (claimed.count === 0) {
        return base;
      }

      const existingInventory = await tx.inventoryItem.findUnique({
        where: {
          hospitalId_bloodGroup: {
            hospitalId: appointment.hospitalId,
            bloodGroup: appointment.donor.bloodGroup,
          },
        },
      });
      const previousUnits = existingInventory?.availableUnits ?? 0;
      const newUnits = previousUnits + unitsCollected;
      const inventory = await tx.inventoryItem.upsert({
        where: {
          hospitalId_bloodGroup: {
            hospitalId: appointment.hospitalId,
            bloodGroup: appointment.donor.bloodGroup,
          },
        },
        update: { availableUnits: newUnits, updatedById: userId },
        create: {
          hospitalId: appointment.hospitalId,
          bloodGroup: appointment.donor.bloodGroup,
          availableUnits: unitsCollected,
          updatedById: userId,
        },
      });

      const donation = await tx.donation.create({
        data: {
          donationNumber,
          donorId: appointment.donorId,
          hospitalId: appointment.hospitalId,
          bloodRequestId: appointment.bloodRequestId,
          bloodGroup: appointment.donor.bloodGroup,
          donatedAt: donationDate,
          unitsDonated: unitsCollected,
          location: appointment.hospital.location,
          screeningResult: 'Completed blood donation appointment',
          notes: [
            `Appointment: ${appointment.appointmentReference}`,
            donationNumber ? `Donation Number: ${donationNumber}` : null,
            `Volume: ${volumeCollectedMl} ml`,
            dto.donationNotes,
          ].filter(Boolean).join(' | '),
        },
      });

      await tx.inventoryLog.create({
        data: {
          inventoryId: inventory.id,
          changeType: InventoryChangeType.ADDED,
          unitsChanged: unitsCollected,
          previousUnits,
          newUnits,
          reason: `Successful donation ${donationNumber ?? donation.id} from appointment ${appointment.appointmentReference} (${appointment.donor.donorNumber ?? appointment.donor.fullName})`,
          changedById: userId,
        },
      });

      await tx.donor.update({
        where: { id: appointment.donorId },
        data: {
          lastDonationDate: donationDate,
          nextEligibilityDate: this.addMonths(donationDate, 2),
          availabilityStatus: false,
        },
      });

      return tx.appointment.update({
        where: { id },
        data: { donationId: donation.id, donationNumber: donation.donationNumber },
      });
    });
        break;
      } catch (error) {
        if (!this.isUniqueConstraint(error, 'donationNumber') || attempt === 4) {
          throw error;
        }
      }
    }
    if (!updated) {
      throw new BadRequestException('Unable to complete donation workflow. Please try again.');
    }
    await this.audit.log('APPOINTMENT_UPDATED', 'APPOINTMENT', userId, id, {
      ...dto,
      appointmentReference: appointment.appointmentReference,
      donationNumber: updated.donationNumber,
    });
    const hospitalNotificationStatuses = new Set<AppointmentStatus>([
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.RESCHEDULED,
      AppointmentStatus.CANCELLED,
    ]);
    if (hospitalNotificationStatuses.has(dto.status)) {
      const notificationTitle = dto.status === AppointmentStatus.RESCHEDULED
        ? `Appointment rescheduled: ${appointment.appointmentReference}`
        : dto.status === AppointmentStatus.CANCELLED
          ? `Appointment cancelled: ${appointment.appointmentReference}`
          : `Appointment confirmed: ${appointment.appointmentReference}`;
      const notificationBody = dto.status === AppointmentStatus.RESCHEDULED
        ? `${appointment.hospital.hospitalName} approved or proposed a new time for appointment ${appointment.appointmentReference}. Please review your appointment details.`
        : dto.status === AppointmentStatus.CANCELLED
          ? `${appointment.hospital.hospitalName} cancelled appointment ${appointment.appointmentReference}.`
          : `${appointment.hospital.hospitalName} confirmed appointment ${appointment.appointmentReference}.`;
      await this.notifyAppointmentParticipants(
        appointment,
        notificationTitle,
        notificationBody,
        dto.status === AppointmentStatus.CANCELLED ? SmsPurpose.APPOINTMENT_CANCELLED : SmsPurpose.APPOINTMENT_RESCHEDULED,
      );
    }
    const finalAppointment = await this.prisma.appointment.findUnique({ where: { id: updated.id }, include: this.appointmentInclude });
    if (finalAppointment) {
      await this.broadcastAppointmentChanged(finalAppointment);
    }
    return finalAppointment;
  }
}
