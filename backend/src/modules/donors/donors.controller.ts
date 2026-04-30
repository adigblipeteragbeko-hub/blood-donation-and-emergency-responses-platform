import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateDonationHistoryDto } from './dto/create-donation-history.dto';
import { UpsertDonorProfileDto } from './dto/upsert-donor-profile.dto';
import { UpdatePassportPhotoDto } from './dto/update-passport-photo.dto';
import { DonorsService } from './donors.service';
import { CreateDonorAdminDto } from './dto/admin/create-donor-admin.dto';
import { UpdateDonorAdminDto } from './dto/admin/update-donor-admin.dto';
import { SubmitHealthEligibilityDto } from './dto/submit-health-eligibility.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { UpdateDonorEligibilityApprovalDto } from './dto/admin/update-donor-eligibility-approval.dto';

@UseGuards(JwtAccessGuard, ActiveUserGuard, RolesGuard)
@Roles(Role.DONOR, Role.ADMIN)
@Controller('donors')
export class DonorsController {
  constructor(private readonly donorsService: DonorsService) {}

  @Post('profile')
  upsertProfile(@CurrentUser() user: { id: string }, @Body() dto: UpsertDonorProfileDto) {
    return this.donorsService.upsertProfile(user.id, dto);
  }

  @Get('profile')
  getProfile(@CurrentUser() user: { id: string }) {
    return this.donorsService.getProfile(user.id);
  }

  @Patch('profile/passport-photo')
  updatePassportPhoto(@CurrentUser() user: { id: string }, @Body() dto: UpdatePassportPhotoDto) {
    return this.donorsService.updatePassportPhoto(user.id, dto.passportPhotoUrl);
  }

  @Post('donations')
  addDonation(@CurrentUser() user: { id: string }, @Body() dto: CreateDonationHistoryDto) {
    return this.donorsService.addDonationHistory(user.id, dto);
  }

  @Post('health-form')
  submitHealthForm(@CurrentUser() user: { id: string }, @Body() dto: SubmitHealthEligibilityDto) {
    return this.donorsService.submitHealthForm(user.id, dto);
  }

  @Get('eligibility/status')
  getEligibilityStatus(@CurrentUser() user: { id: string }) {
    return this.donorsService.getEligibilityStatus(user.id);
  }

  @Patch('availability')
  updateAvailability(@CurrentUser() user: { id: string }, @Body() dto: UpdateAvailabilityDto) {
    return this.donorsService.updateAvailability(user.id, dto.available);
  }

  @Get('hospital-options')
  hospitalOptions() {
    return this.donorsService.getHospitalOptions();
  }

  @Roles(Role.ADMIN)
  @Get('admin')
  listAllForAdmin() {
    return this.donorsService.listAllForAdmin();
  }

  @Roles(Role.ADMIN)
  @Post('admin')
  createByAdmin(@Body() dto: CreateDonorAdminDto, @CurrentUser() user: { id: string }) {
    return this.donorsService.createByAdmin(dto, user.id);
  }

  @Roles(Role.ADMIN)
  @Patch('admin/:id')
  updateByAdmin(
    @Param('id') id: string,
    @Body() dto: UpdateDonorAdminDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.donorsService.updateByAdmin(id, dto, user.id);
  }

  @Roles(Role.ADMIN)
  @Patch('admin/:id/eligibility')
  updateEligibilityApproval(
    @Param('id') id: string,
    @Body() dto: UpdateDonorEligibilityApprovalDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.donorsService.updateEligibilityApproval(id, dto.approved, user.id);
  }

  @Roles(Role.ADMIN)
  @Delete('admin/:id')
  removeByAdmin(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.donorsService.removeByAdmin(id, user.id);
  }
}
