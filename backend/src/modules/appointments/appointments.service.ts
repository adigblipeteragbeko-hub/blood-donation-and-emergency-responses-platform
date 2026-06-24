import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
import { AuditService } from '../../common/audit/audit.service';
import { CreateHospitalAppointmentDto } from './dto/create-hospital-appointment.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { HospitalAccessService } from '../../common/rbac/hospital-access.service';
import {
  AppointmentStatus,
  AppointmentType,
  BloodGroup,
  DonorClinicalStatus,
  InventoryChangeType,
  NotificationType,
  Prisma,
  Role,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly hospitalAccess: HospitalAccessService,
    private readonly notifications: NotificationsService,
  ) {}

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
            OR: [
              { fullName: { contains: term, mode: 'insensitive' as const } },
              { firstName: { contains: term, mode: 'insensitive' as const } },
              { otherNames: { contains: term, mode: 'insensitive' as const } },
              { surname: { contains: term, mode: 'insensitive' as const } },
              { donorNumber: { contains: term, mode: 'insensitive' as const } },
              { location: { contains: term, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
  }

  async create(userId: string, dto: CreateAppointmentDto) {
    const donor = await this.prisma.donor.findUnique({ where: { userId } });
    if (!donor) {
      throw new NotFoundException('Donor profile not found');
    }

    const appointment = await this.createAppointmentWithReference({
      donor: { connect: { id: donor.id } },
      hospital: { connect: { id: dto.hospitalId } },
      scheduledAt: new Date(dto.scheduledAt),
      appointmentType: dto.appointmentType ?? AppointmentType.BLOOD_DONATION,
      notes: dto.notes,
    });

    await this.audit.log('APPOINTMENT_CREATED', 'APPOINTMENT', userId, appointment.id, {
      ...dto,
      appointmentReference: appointment.appointmentReference,
    });
    return appointment;
  }

  async createByHospital(userId: string, dto: CreateHospitalAppointmentDto) {
    const hospital = await this.hospitalAccess.getHospitalForUser(userId);

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
        scheduledAt: new Date(dto.scheduledAt),
        appointmentType: dto.appointmentType ?? AppointmentType.BLOOD_DONATION,
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

    await this.audit.log('APPOINTMENT_CREATED_BY_HOSPITAL', 'APPOINTMENT', userId, appointment.id, {
      ...dto,
      appointmentReference: appointment.appointmentReference,
    });
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
        donationHistory: { orderBy: { donatedAt: 'desc' }, take: 1, select: { donatedAt: true } },
      },
    });
  }

  async listForUser(userId: string, role: Role, query: PaginationQueryDto) {
    const skip = query.skip ?? 0;
    const take = query.take ?? 100;
    if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
      return this.prisma.appointment.findMany({
        include: this.appointmentInclude,
        orderBy: { scheduledAt: 'asc' },
        skip,
        take,
      });
    }

    if (role === Role.DONOR) {
      return this.prisma.appointment.findMany({
        where: { donor: { userId } },
        include: this.appointmentInclude,
        orderBy: { scheduledAt: 'asc' },
        skip,
        take,
      });
    }

    const hospital = await this.hospitalAccess.getHospitalForUser(userId);
    return this.prisma.appointment.findMany({
      where: { hospitalId: hospital.id },
      include: this.appointmentInclude,
      orderBy: { scheduledAt: 'asc' },
      skip,
      take,
    });
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
    const unitsCollected = Number(dto.unitsCollected ?? appointment.unitsCollected ?? 0);
    const volumeCollectedMl = dto.volumeCollectedMl ?? appointment.volumeCollectedMl ?? 450;

    if (shouldPostDonation && !appointment.donationPostedAt) {
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
    return this.prisma.appointment.findUnique({ where: { id: updated.id }, include: this.appointmentInclude });
  }
}
