import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { CreateHospitalAppointmentDto } from './dto/create-hospital-appointment.dto';
import { DeclineAppointmentDto } from './dto/decline-appointment.dto';
import { RequestAppointmentRescheduleDto } from './dto/request-appointment-reschedule.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { AppointmentQueryDto } from './dto/appointment-query.dto';

@UseGuards(JwtAccessGuard, ActiveUserGuard, RolesGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Roles(Role.DONOR)
  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateAppointmentDto) {
    return this.appointmentsService.create(user.id, dto);
  }

  @Roles(Role.HOSPITAL_ADMIN, Role.ADMIN)
  @Post('hospital')
  createByHospital(@CurrentUser() user: { id: string }, @Body() dto: CreateHospitalAppointmentDto) {
    return this.appointmentsService.createByHospital(user.id, dto);
  }

  @Roles(Role.HOSPITAL_ADMIN)
  @Get('eligible-donors')
  eligibleDonors(@CurrentUser() user: { id: string }, @Query() query: PaginationQueryDto & { search?: string }) {
    return this.appointmentsService.listEligibleDonors(user.id, query);
  }

  @Roles(
    Role.ADMIN,
    Role.ADMIN,
    Role.DONOR,
    Role.HOSPITAL_ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.HOSPITAL_ADMIN,
  )
  @Get()
  listForUser(
    @CurrentUser() user: { id: string; role: Role },
    @Query() query: AppointmentQueryDto,
  ) {
    return this.appointmentsService.listForUser(user.id, user.role, query);
  }

  @Roles(Role.ADMIN, Role.HOSPITAL_ADMIN)
  @Get('summary')
  summary(
    @CurrentUser() user: { id: string; role: Role },
    @Query() query: AppointmentQueryDto,
  ) {
    return this.appointmentsService.summaryForUser(user.id, user.role, query);
  }

  @Roles(Role.ADMIN, Role.HOSPITAL_ADMIN)
  @Get(':id/donation-number-preview')
  previewDonationNumber(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.appointmentsService.previewDonationNumber(id, user.id, user.role);
  }

  @Roles(Role.DONOR)
  @Patch(':id/accept')
  acceptAppointment(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.appointmentsService.acceptAppointment(id, user.id);
  }

  @Roles(Role.DONOR)
  @Patch(':id/reschedule-request')
  requestReschedule(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: RequestAppointmentRescheduleDto,
  ) {
    return this.appointmentsService.requestReschedule(id, user.id, dto);
  }

  @Roles(Role.DONOR)
  @Patch(':id/decline')
  declineAppointment(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: DeclineAppointmentDto,
  ) {
    return this.appointmentsService.declineAppointment(id, user.id, dto);
  }

  @Roles(Role.DONOR)
  @Patch(':id/cancel')
  cancelAppointment(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.appointmentsService.cancelAppointmentByDonor(id, user.id);
  }

  @Roles(Role.ADMIN, Role.HOSPITAL_ADMIN)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: Role },
    @Body() dto: UpdateAppointmentStatusDto,
  ) {
    return this.appointmentsService.updateStatus(id, user.id, user.role, dto);
  }
}

