import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpsertHospitalProfileDto } from './dto/upsert-hospital-profile.dto';
import { HospitalsService } from './hospitals.service';
import { CreateHospitalAdminDto } from './dto/admin/create-hospital-admin.dto';
import { UpdateHospitalAdminDto } from './dto/admin/update-hospital-admin.dto';
import { DonorSearchDto } from './dto/donor-search.dto';

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

  @Get('donor-search')
  donorSearch(@CurrentUser() user: { id: string }, @Query() query: DonorSearchDto) {
    return this.hospitalsService.searchDonors(user.id, query);
  }

  @Roles(Role.ADMIN)
  @Get('admin')
  listAllForAdmin() {
    return this.hospitalsService.listAllForAdmin();
  }

  @Roles(Role.ADMIN)
  @Post('admin')
  createByAdmin(@Body() dto: CreateHospitalAdminDto, @CurrentUser() user: { id: string }) {
    return this.hospitalsService.createByAdmin(dto, user.id);
  }

  @Roles(Role.ADMIN)
  @Patch('admin/:id')
  updateByAdmin(
    @Param('id') id: string,
    @Body() dto: UpdateHospitalAdminDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.hospitalsService.updateByAdmin(id, dto, user.id);
  }

  @Roles(Role.ADMIN)
  @Delete('admin/:id')
  removeByAdmin(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.hospitalsService.removeByAdmin(id, user.id);
  }
}
