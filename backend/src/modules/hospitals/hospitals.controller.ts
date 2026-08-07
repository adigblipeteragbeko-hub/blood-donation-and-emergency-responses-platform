import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PermissionCode, Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Permissions } from '../../common/rbac/permissions.decorator';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { UpsertHospitalProfileDto } from './dto/upsert-hospital-profile.dto';
import { HospitalsService } from './hospitals.service';
import { CreateHospitalAdminDto } from './dto/admin/create-hospital-admin.dto';
import { UpdateHospitalAdminDto } from './dto/admin/update-hospital-admin.dto';
import { DonorSearchDto } from './dto/donor-search.dto';
import { SubmitOfficeUseDto } from './dto/submit-office-use.dto';
import { ApproveDonorEligibilityDto } from './dto/approve-donor-eligibility.dto';
import { UpdateHospitalLogoDto } from './dto/update-hospital-logo.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@UseGuards(JwtAccessGuard, ActiveUserGuard, RolesGuard, PermissionsGuard)
@Roles(
  Role.HOSPITAL_ADMIN,
  Role.HOSPITAL_ADMIN,
  Role.HOSPITAL_ADMIN,
  Role.ADMIN,
  Role.ADMIN,
)
@Permissions([PermissionCode.HOSPITAL_OPERATIONS_VIEW], 'any')
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

  @Patch('profile/logo')
  updateLogo(@CurrentUser() user: { id: string }, @Body() dto: UpdateHospitalLogoDto) {
    return this.hospitalsService.updateLogo(user.id, dto.logoUrl);
  }

  @Get('donor-search')
  @Permissions([PermissionCode.DONOR_MATCH_VIEW], 'all')
  donorSearch(@CurrentUser() user: { id: string }, @Query() query: DonorSearchDto) {
    return this.hospitalsService.searchDonors(user.id, query);
  }

  @Get('typeahead')
  @Permissions([PermissionCode.HOSPITAL_OPERATIONS_VIEW], 'all')
  typeahead(@CurrentUser() user: { id: string }, @Query('q') q?: string) {
    return this.hospitalsService.getTypeaheadSuggestions(user.id, q ?? '');
  }

  @Get('eligibility-submissions')
  @Permissions([PermissionCode.DONOR_REVIEW_MANAGE, PermissionCode.DONOR_REVIEW_APPROVE], 'any')
  getEligibilitySubmissions(@CurrentUser() user: { id: string }) {
    return this.hospitalsService.getEligibilitySubmissions(user.id);
  }

  @Post('eligibility-submissions/:donorId/office-use')
  @Permissions([PermissionCode.DONOR_REVIEW_MANAGE], 'all')
  submitOfficeUse(
    @CurrentUser() user: { id: string },
    @Param('donorId') donorId: string,
    @Body() dto: SubmitOfficeUseDto,
  ) {
    return this.hospitalsService.submitOfficeUse(user.id, donorId, dto.officeUseOnly);
  }

  @Patch('eligibility-submissions/:donorId/approve')
  @Permissions([PermissionCode.DONOR_REVIEW_APPROVE], 'all')
  approveEligibility(
    @CurrentUser() user: { id: string },
    @Param('donorId') donorId: string,
    @Body() dto: ApproveDonorEligibilityDto,
  ) {
    return this.hospitalsService.approveEligibility(user.id, donorId, dto.approved);
  }

  @Roles(Role.ADMIN)
  @Permissions([PermissionCode.HOSPITAL_APPROVE, PermissionCode.HOSPITAL_ADMIN_MANAGE], 'any')
  @Get('admin')
  listAllForAdmin(@Query() query: PaginationQueryDto) {
    return this.hospitalsService.listAllForAdmin(query);
  }

  @Roles(Role.ADMIN)
  @Permissions([PermissionCode.HOSPITAL_APPROVE, PermissionCode.HOSPITAL_ADMIN_MANAGE], 'any')
  @Post('admin')
  createByAdmin(@Body() dto: CreateHospitalAdminDto, @CurrentUser() user: { id: string }) {
    return this.hospitalsService.createByAdmin(dto, user.id);
  }

  @Roles(Role.ADMIN)
  @Permissions([PermissionCode.HOSPITAL_APPROVE, PermissionCode.HOSPITAL_ADMIN_MANAGE], 'any')
  @Patch('admin/:id')
  updateByAdmin(
    @Param('id') id: string,
    @Body() dto: UpdateHospitalAdminDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.hospitalsService.updateByAdmin(id, dto, user.id);
  }

  @Roles(Role.ADMIN)
  @Permissions([PermissionCode.HOSPITAL_APPROVE, PermissionCode.HOSPITAL_ADMIN_MANAGE], 'any')
  @Delete('admin/:id')
  removeByAdmin(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.hospitalsService.removeByAdmin(id, user.id);
  }
}

