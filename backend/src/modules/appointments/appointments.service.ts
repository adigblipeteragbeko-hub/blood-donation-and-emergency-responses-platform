import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
import { AuditService } from '../../common/audit/audit.service';
import { CreateHospitalAppointmentDto } from './dto/create-hospital-appointment.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { HospitalAccessService } from '../../common/rbac/hospital-access.service';
import { Role } from '@prisma/client';

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly hospitalAccess: HospitalAccessService,
  ) {}

  async create(userId: string, dto: CreateAppointmentDto) {
    const donor = await this.prisma.donor.findUnique({ where: { userId } });
    if (!donor) {
      throw new NotFoundException('Donor profile not found');
    }

    const appointment = await this.prisma.appointment.create({
      data: {
        donorId: donor.id,
        hospitalId: dto.hospitalId,
        scheduledAt: new Date(dto.scheduledAt),
        notes: dto.notes,
      },
    });

    await this.audit.log('APPOINTMENT_CREATED', 'APPOINTMENT', userId, appointment.id, dto);
    return appointment;
  }

  async createByHospital(userId: string, dto: CreateHospitalAppointmentDto) {
    const hospital = await this.hospitalAccess.getHospitalForUser(userId);

    const donor = await this.prisma.donor.findUnique({ where: { id: dto.donorId } });
    if (!donor) {
      throw new NotFoundException('Donor not found');
    }

    const appointment = await this.prisma.appointment.create({
      data: {
        donorId: donor.id,
        hospitalId: hospital.id,
        scheduledAt: new Date(dto.scheduledAt),
        notes: dto.notes,
      },
      include: {
        donor: { select: { id: true, fullName: true, bloodGroup: true, location: true } },
      },
    });

    await this.audit.log('APPOINTMENT_CREATED_BY_HOSPITAL', 'APPOINTMENT', userId, appointment.id, dto);
    return appointment;
  }

  async listForUser(userId: string, role: Role, query: PaginationQueryDto) {
    const skip = query.skip ?? 0;
    const take = query.take ?? 100;
    if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
      return this.prisma.appointment.findMany({
        include: { donor: true, hospital: true },
        orderBy: { scheduledAt: 'asc' },
        skip,
        take,
      });
    }

    if (role === Role.DONOR) {
      return this.prisma.appointment.findMany({
        where: { donor: { userId } },
        include: { hospital: true },
        orderBy: { scheduledAt: 'asc' },
        skip,
        take,
      });
    }

    const hospital = await this.hospitalAccess.getHospitalForUser(userId);
    return this.prisma.appointment.findMany({
      where: { hospitalId: hospital.id },
      include: { donor: true },
      orderBy: { scheduledAt: 'asc' },
      skip,
      take,
    });
  }

  async updateStatus(
    id: string,
    userId: string,
    role: Role,
    dto: UpdateAppointmentStatusDto,
  ) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: { hospital: { select: { userId: true } } },
    });
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    await this.hospitalAccess.assertHospitalAccess(appointment.hospitalId, userId, role);

    const updated = await this.prisma.appointment.update({ where: { id }, data: { status: dto.status } });
    await this.audit.log('APPOINTMENT_UPDATED', 'APPOINTMENT', userId, id, dto);
    return updated;
  }
}
