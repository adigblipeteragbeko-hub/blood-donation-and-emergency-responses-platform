import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateBloodRequestDto } from './dto/create-blood-request.dto';
import { CreateBloodRequestUpdateDto } from './dto/create-blood-request-update.dto';
import { RespondToBloodRequestDto } from './dto/respond-to-blood-request.dto';
import { UpdateBloodRequestStatusDto } from './dto/update-blood-request-status.dto';
import { AdminCorrectCompletionDto } from './dto/admin-correct-completion.dto';
import { BloodRequestsService } from './blood-requests.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@UseGuards(JwtAccessGuard, ActiveUserGuard, RolesGuard)
@Controller('blood-requests')
export class BloodRequestsController {
  constructor(private readonly bloodRequestsService: BloodRequestsService) {}

  @Roles(Role.HOSPITAL_STAFF, Role.HOSPITAL_STAFF, Role.ADMIN, Role.SUPER_ADMIN)
  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateBloodRequestDto) {
    return this.bloodRequestsService.create(user.id, dto);
  }

  @Roles(
    Role.ADMIN,
    Role.SUPER_ADMIN,
    Role.HOSPITAL_STAFF,
    Role.HOSPITAL_STAFF,
    Role.BLOOD_BANK_OFFICER,
    Role.BLOOD_BANK_OFFICER,
    Role.DONOR,
  )
  @Get()
  listAll(@CurrentUser() user: { id: string; role: Role }, @Query() query: PaginationQueryDto) {
    return this.bloodRequestsService.listAll(user.id, user.role, query);
  }

  @Roles(Role.HOSPITAL_STAFF, Role.HOSPITAL_STAFF, Role.ADMIN, Role.SUPER_ADMIN)
  @Get('mine')
  listMine(@CurrentUser() user: { id: string; role: Role }, @Query() query: PaginationQueryDto) {
    return this.bloodRequestsService.listMine(user.id, user.role, query);
  }

  @Roles(Role.HOSPITAL_STAFF, Role.HOSPITAL_STAFF, Role.ADMIN, Role.SUPER_ADMIN)
  @Post('escalation/check')
  runEscalationCheck(@CurrentUser() user: { id: string; role: Role }) {
    return this.bloodRequestsService.runEscalationCheck(user.id, user.role);
  }

  @Roles(
    Role.ADMIN,
    Role.SUPER_ADMIN,
    Role.HOSPITAL_STAFF,
    Role.HOSPITAL_STAFF,
    Role.BLOOD_BANK_OFFICER,
    Role.BLOOD_BANK_OFFICER,
    Role.DONOR,
  )
  @Get(':id')
  getById(@Param('id') id: string, @CurrentUser() user: { id: string; role: Role }) {
    return this.bloodRequestsService.getById(id, user.id, user.role);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.HOSPITAL_STAFF, Role.HOSPITAL_STAFF)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: Role },
    @Body() dto: UpdateBloodRequestStatusDto,
  ) {
    return this.bloodRequestsService.updateStatus(id, user.id, user.role, dto);
  }

  @Roles(
    Role.ADMIN,
    Role.SUPER_ADMIN,
    Role.HOSPITAL_STAFF,
    Role.HOSPITAL_STAFF,
    Role.BLOOD_BANK_OFFICER,
    Role.BLOOD_BANK_OFFICER,
    Role.DONOR,
  )
  @Get(':id/updates')
  listUpdates(@Param('id') id: string, @CurrentUser() user: { id: string; role: Role }, @Query() query: PaginationQueryDto) {
    return this.bloodRequestsService.listUpdates(id, user.id, user.role, query);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.HOSPITAL_STAFF, Role.HOSPITAL_STAFF)
  @Post(':id/updates')
  createUpdate(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: Role },
    @Body() dto: CreateBloodRequestUpdateDto,
  ) {
    return this.bloodRequestsService.createUpdate(id, user.id, user.role, dto);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post(':id/completion-correction')
  correctCompletion(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: Role },
    @Body() dto: AdminCorrectCompletionDto,
  ) {
    return this.bloodRequestsService.adminCorrectCompletion(id, user.id, dto);
  }

  @Roles(
    Role.ADMIN,
    Role.SUPER_ADMIN,
    Role.HOSPITAL_STAFF,
    Role.HOSPITAL_STAFF,
    Role.BLOOD_BANK_OFFICER,
    Role.BLOOD_BANK_OFFICER,
    Role.DONOR,
  )
  @Get(':id/donor-responses')
  listDonorResponses(@Param('id') id: string, @CurrentUser() user: { id: string; role: Role }, @Query() query: PaginationQueryDto) {
    return this.bloodRequestsService.listDonorResponses(id, user.id, user.role, query);
  }

  @Roles(Role.DONOR)
  @Post(':id/respond')
  respondToRequest(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: RespondToBloodRequestDto,
  ) {
    return this.bloodRequestsService.respondToRequest(id, user.id, dto);
  }
}

