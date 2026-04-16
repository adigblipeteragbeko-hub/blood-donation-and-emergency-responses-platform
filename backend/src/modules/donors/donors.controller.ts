import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateDonationHistoryDto } from './dto/create-donation-history.dto';
import { UpsertDonorProfileDto } from './dto/upsert-donor-profile.dto';
import { DonorsService } from './donors.service';

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

  @Post('donations')
  addDonation(@CurrentUser() user: { id: string }, @Body() dto: CreateDonationHistoryDto) {
    return this.donorsService.addDonationHistory(user.id, dto);
  }
}
