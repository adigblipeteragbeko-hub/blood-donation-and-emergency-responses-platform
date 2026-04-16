import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateBloodRequestDto } from './dto/create-blood-request.dto';
import { UpdateBloodRequestStatusDto } from './dto/update-blood-request-status.dto';
import { BloodRequestsService } from './blood-requests.service';

@UseGuards(JwtAccessGuard, ActiveUserGuard, RolesGuard)
@Controller('blood-requests')
export class BloodRequestsController {
  constructor(private readonly bloodRequestsService: BloodRequestsService) {}

  @Roles(Role.HOSPITAL_STAFF, Role.ADMIN)
  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateBloodRequestDto) {
    return this.bloodRequestsService.create(user.id, dto);
  }

  @Roles(Role.ADMIN, Role.HOSPITAL_STAFF, Role.DONOR)
  @Get()
  listAll() {
    return this.bloodRequestsService.listAll();
  }

  @Roles(Role.ADMIN, Role.HOSPITAL_STAFF)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateBloodRequestStatusDto,
  ) {
    return this.bloodRequestsService.updateStatus(id, user.id, dto);
  }
}
