import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';

@UseGuards(JwtAccessGuard, ActiveUserGuard, RolesGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Roles(Role.DONOR)
  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateAppointmentDto) {
    return this.appointmentsService.create(user.id, dto);
  }

  @Roles(Role.ADMIN, Role.DONOR, Role.HOSPITAL_STAFF)
  @Get()
  listForUser(@CurrentUser() user: { id: string; role: 'ADMIN' | 'DONOR' | 'HOSPITAL_STAFF' }) {
    return this.appointmentsService.listForUser(user.id, user.role);
  }

  @Roles(Role.ADMIN, Role.HOSPITAL_STAFF)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateAppointmentStatusDto,
  ) {
    return this.appointmentsService.updateStatus(id, user.id, dto);
  }
}
