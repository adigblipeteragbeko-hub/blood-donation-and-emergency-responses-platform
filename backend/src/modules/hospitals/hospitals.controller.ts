import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpsertHospitalProfileDto } from './dto/upsert-hospital-profile.dto';
import { HospitalsService } from './hospitals.service';

@UseGuards(JwtAccessGuard, ActiveUserGuard, RolesGuard)
@Roles(Role.HOSPITAL_STAFF, Role.ADMIN)
@Controller('hospitals')
export class HospitalsController {
  constructor(private readonly hospitalsService: HospitalsService) {}

  @Post('profile')
  upsertProfile(@CurrentUser() user: { id: string }, @Body() dto: UpsertHospitalProfileDto) {
    return this.hospitalsService.upsertProfile(user.id, dto);
  }

  @Get('profile')
  getProfile(@CurrentUser() user: { id: string }) {
    return this.hospitalsService.getProfile(user.id);
  }
}
