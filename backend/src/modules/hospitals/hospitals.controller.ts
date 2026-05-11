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
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CreateHospitalDepartmentDto } from './dto/create-hospital-department.dto';
import { UpdateHospitalDepartmentDto } from './dto/update-hospital-department.dto';
import { CreateHospitalStaffDto } from './dto/create-hospital-staff.dto';
import { UpdateHospitalStaffDto } from './dto/update-hospital-staff.dto';
import { UpdateHospitalStaffStatusDto } from './dto/update-hospital-staff-status.dto';
import { HospitalStaffQueryDto } from './dto/hospital-staff-query.dto';

@UseGuards(JwtAccessGuard, ActiveUserGuard, RolesGuard, PermissionsGuard)
@Roles(
  Role.HOSPITAL_ADMIN,
  Role.HOSPITAL_STAFF,
  Role.DONOR_REVIEW_OFFICER,
  Role.ADMIN,
  Role.SUPER_ADMIN,
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

  @Get('donor-search')
  @Permissions([PermissionCode.DONOR_MATCH_VIEW], 'all')
  donorSearch(@CurrentUser() user: { id: string }, @Query() query: DonorSearchDto) {
    return this.hospitalsService.searchDonors(user.id, query);
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

  @Get('departments')
  @Permissions([PermissionCode.HOSPITAL_OPERATIONS_VIEW], 'all')
  listDepartments(@CurrentUser() user: { id: string }) {
    return this.hospitalsService.listDepartments(user.id);
  }

  @Post('departments')
  @Roles(Role.HOSPITAL_ADMIN, Role.ADMIN, Role.SUPER_ADMIN)
  @Permissions([PermissionCode.HOSPITAL_STAFF_MANAGE], 'all')
  createDepartment(@CurrentUser() user: { id: string }, @Body() dto: CreateHospitalDepartmentDto) {
    return this.hospitalsService.createDepartment(user.id, dto);
  }

  @Patch('departments/:departmentId')
  @Roles(Role.HOSPITAL_ADMIN, Role.ADMIN, Role.SUPER_ADMIN)
  @Permissions([PermissionCode.HOSPITAL_STAFF_MANAGE], 'all')
  updateDepartment(
    @CurrentUser() user: { id: string },
    @Param('departmentId') departmentId: string,
    @Body() dto: UpdateHospitalDepartmentDto,
  ) {
    return this.hospitalsService.updateDepartment(user.id, departmentId, dto);
  }

  @Get('staff')
  @Permissions([PermissionCode.HOSPITAL_STAFF_MANAGE, PermissionCode.HOSPITAL_OPERATIONS_VIEW], 'any')
  listStaff(@CurrentUser() user: { id: string }, @Query() query: HospitalStaffQueryDto) {
    return this.hospitalsService.listStaff(user.id, query);
  }

  @Post('staff')
  @Roles(Role.HOSPITAL_ADMIN, Role.ADMIN, Role.SUPER_ADMIN)
  @Permissions([PermissionCode.HOSPITAL_STAFF_MANAGE], 'all')
  createStaff(@CurrentUser() user: { id: string }, @Body() dto: CreateHospitalStaffDto) {
    return this.hospitalsService.createStaff(user.id, dto);
  }

  @Patch('staff/:staffId')
  @Roles(Role.HOSPITAL_ADMIN, Role.ADMIN, Role.SUPER_ADMIN)
  @Permissions([PermissionCode.HOSPITAL_STAFF_MANAGE], 'all')
  updateStaff(
    @CurrentUser() user: { id: string },
    @Param('staffId') staffId: string,
    @Body() dto: UpdateHospitalStaffDto,
  ) {
    return this.hospitalsService.updateStaff(user.id, staffId, dto);
  }

  @Patch('staff/:staffId/status')
  @Roles(Role.HOSPITAL_ADMIN, Role.ADMIN, Role.SUPER_ADMIN)
  @Permissions([PermissionCode.HOSPITAL_STAFF_MANAGE], 'all')
  updateStaffStatus(
    @CurrentUser() user: { id: string },
    @Param('staffId') staffId: string,
    @Body() dto: UpdateHospitalStaffStatusDto,
  ) {
    return this.hospitalsService.updateStaffStatus(user.id, staffId, dto);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Permissions([PermissionCode.HOSPITAL_APPROVE, PermissionCode.HOSPITAL_STAFF_MANAGE], 'any')
  @Get('admin')
  listAllForAdmin(@Query() query: PaginationQueryDto) {
    return this.hospitalsService.listAllForAdmin(query);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Permissions([PermissionCode.HOSPITAL_APPROVE, PermissionCode.HOSPITAL_STAFF_MANAGE], 'any')
  @Post('admin')
  createByAdmin(@Body() dto: CreateHospitalAdminDto, @CurrentUser() user: { id: string }) {
    return this.hospitalsService.createByAdmin(dto, user.id);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Permissions([PermissionCode.HOSPITAL_APPROVE, PermissionCode.HOSPITAL_STAFF_MANAGE], 'any')
  @Patch('admin/:id')
  updateByAdmin(
    @Param('id') id: string,
    @Body() dto: UpdateHospitalAdminDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.hospitalsService.updateByAdmin(id, dto, user.id);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Permissions([PermissionCode.HOSPITAL_APPROVE, PermissionCode.HOSPITAL_STAFF_MANAGE], 'any')
  @Delete('admin/:id')
  removeByAdmin(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.hospitalsService.removeByAdmin(id, user.id);
  }
}
