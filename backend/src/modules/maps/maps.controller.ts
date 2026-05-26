import { Body, Controller, Get, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MapsService } from './maps.service';
import { NearbyDonorQueryDto } from './dto/nearby-donor-query.dto';
import { UpdateDonorLocationDto } from './dto/update-donor-location.dto';
import { OperationalDonorQueryDto } from './dto/operational-donor-query.dto';

@UseGuards(JwtAccessGuard, ActiveUserGuard, RolesGuard)
@Controller('maps')
export class MapsController {
  constructor(private readonly mapsService: MapsService) {}

  @Roles(Role.DONOR)
  @Patch('donor/location')
  updateOwnLocation(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateDonorLocationDto,
    @Req() request: Request,
  ) {
    return this.mapsService.updateOwnDonorLocation(user.id, dto, request.ip, String(request.headers['user-agent'] ?? ''));
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HOSPITAL_STAFF, Role.HOSPITAL_STAFF, Role.BLOOD_BANK_OFFICER)
  @Get('nearby-donors')
  nearbyDonors(
    @CurrentUser() user: { id: string; role: Role },
    @Query() query: NearbyDonorQueryDto,
    @Req() request: Request,
  ) {
    return this.mapsService.findNearbyEligibleDonors(user.id, user.role, query, request.ip, String(request.headers['user-agent'] ?? ''));
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HOSPITAL_STAFF, Role.HOSPITAL_STAFF, Role.BLOOD_BANK_OFFICER)
  @Get('donor-coverage')
  donorCoverage(@CurrentUser() user: { id: string; role: Role }, @Req() request: Request) {
    return this.mapsService.getDonorCoverage(user.id, user.role, request.ip, String(request.headers['user-agent'] ?? ''));
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HOSPITAL_STAFF, Role.HOSPITAL_STAFF, Role.BLOOD_BANK_OFFICER)
  @Get('operational-donors')
  operationalDonors(
    @CurrentUser() user: { id: string; role: Role },
    @Query() query: OperationalDonorQueryDto,
    @Req() request: Request,
  ) {
    return this.mapsService.getOperationalDonors(user.id, user.role, query, request.ip, String(request.headers['user-agent'] ?? ''));
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HOSPITAL_STAFF, Role.HOSPITAL_STAFF, Role.BLOOD_BANK_OFFICER)
  @Get('operations')
  operationsMap(@CurrentUser() user: { id: string; role: Role }, @Req() request: Request) {
    return this.mapsService.getOperationsMap(user.id, user.role, request.ip, String(request.headers['user-agent'] ?? ''));
  }
}

