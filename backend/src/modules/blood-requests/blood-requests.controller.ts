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
import { CancelBloodRequestDto, UpdateBloodRequestDto } from './dto/update-blood-request.dto';
import { AdminCorrectCompletionDto } from './dto/admin-correct-completion.dto';
import {
  DispatchHospitalBloodTransferDto,
  ReceiveHospitalBloodTransferDto,
  RespondToHospitalRequestDto,
  UpdateHospitalRequestResponseStatusDto,
} from './dto/respond-to-hospital-request.dto';
import { BloodRequestsService } from './blood-requests.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@UseGuards(JwtAccessGuard, ActiveUserGuard, RolesGuard)
@Controller('blood-requests')
export class BloodRequestsController {
  constructor(private readonly bloodRequestsService: BloodRequestsService) {}

  @Roles(Role.HOSPITAL_ADMIN, Role.ADMIN)
  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateBloodRequestDto) {
    return this.bloodRequestsService.create(user.id, dto);
  }

  @Roles(
    Role.ADMIN,
    Role.ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.DONOR,
  )
  @Get()
  listAll(@CurrentUser() user: { id: string; role: Role }, @Query() query: PaginationQueryDto) {
    return this.bloodRequestsService.listAll(user.id, user.role, query);
  }

  @Roles(Role.DONOR, Role.HOSPITAL_ADMIN, Role.ADMIN)
  @Get('reference/:requestReference/validate')
  validateReference(@Param('requestReference') requestReference: string) {
    return this.bloodRequestsService.validateReference(requestReference);
  }

  @Roles(Role.HOSPITAL_ADMIN, Role.ADMIN)
  @Get('mine')
  listMine(@CurrentUser() user: { id: string; role: Role }, @Query() query: PaginationQueryDto) {
    return this.bloodRequestsService.listMine(user.id, user.role, query);
  }

  @Roles(Role.HOSPITAL_ADMIN, Role.ADMIN)
  @Get('hospital-active')
  listHospitalActive(@CurrentUser() user: { id: string; role: Role }, @Query() query: PaginationQueryDto) {
    return this.bloodRequestsService.listHospitalActive(user.id, user.role, query);
  }

  @Roles(Role.HOSPITAL_ADMIN, Role.ADMIN)
  @Get('hospital-active/summary')
  hospitalActiveSummary(@CurrentUser() user: { id: string; role: Role }) {
    return this.bloodRequestsService.hospitalActiveSummary(user.id, user.role);
  }

  @Roles(Role.HOSPITAL_ADMIN, Role.ADMIN)
  @Get('hospital-history')
  listHospitalHistory(@CurrentUser() user: { id: string; role: Role }, @Query() query: PaginationQueryDto) {
    return this.bloodRequestsService.listHospitalHistory(user.id, user.role, query);
  }

  @Roles(Role.HOSPITAL_ADMIN, Role.ADMIN)
  @Get('hospital-active/:id')
  getHospitalActiveById(@Param('id') id: string, @CurrentUser() user: { id: string; role: Role }) {
    return this.bloodRequestsService.getHospitalActiveById(id, user.id, user.role);
  }

  @Roles(Role.HOSPITAL_ADMIN, Role.ADMIN)
  @Patch('hospital-active/:id')
  updateHospitalActiveRequest(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: Role },
    @Body() dto: UpdateBloodRequestDto,
  ) {
    return this.bloodRequestsService.updateHospitalActiveRequest(id, user.id, user.role, dto);
  }

  @Roles(Role.HOSPITAL_ADMIN, Role.ADMIN)
  @Patch('hospital-active/:id/cancel')
  cancelHospitalActiveRequest(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: Role },
    @Body() dto: CancelBloodRequestDto,
  ) {
    return this.bloodRequestsService.cancelHospitalActiveRequest(id, user.id, user.role, dto);
  }

  @Roles(Role.DONOR)
  @Get('donor-emergency')
  listDonorEmergencyRequests(@CurrentUser() user: { id: string }, @Query() query: PaginationQueryDto) {
    return this.bloodRequestsService.listDonorEmergencyRequests(user.id, query);
  }

  @Roles(Role.DONOR)
  @Get('donor-emergency/:id')
  getDonorEmergencyRequestById(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.bloodRequestsService.getDonorEmergencyRequestById(id, user.id);
  }

  @Roles(Role.HOSPITAL_ADMIN, Role.ADMIN)
  @Patch('hospital-active/:id/status')
  updateHospitalActiveStatus(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: Role },
    @Body() dto: UpdateBloodRequestStatusDto,
  ) {
    return this.bloodRequestsService.updateHospitalActiveStatus(id, user.id, user.role, dto);
  }

  @Roles(Role.HOSPITAL_ADMIN, Role.ADMIN)
  @Patch(':id/emergency-notification/resolve')
  resolveEmergencyNotification(@Param('id') id: string, @CurrentUser() user: { id: string; role: Role }) {
    return this.bloodRequestsService.resolveEmergencyNotification(id, user.id, user.role);
  }

  @Roles(Role.HOSPITAL_ADMIN)
  @Post('hospital-active/:id/respond')
  respondAsHospital(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: Role },
    @Body() dto: RespondToHospitalRequestDto,
  ) {
    return this.bloodRequestsService.respondAsHospital(id, user.id, user.role, dto);
  }

  @Roles(Role.HOSPITAL_ADMIN, Role.ADMIN)
  @Patch('hospital-active/:id/responses/:responseId/status')
  updateHospitalResponseStatus(
    @Param('id') id: string,
    @Param('responseId') responseId: string,
    @CurrentUser() user: { id: string; role: Role },
    @Body() dto: UpdateHospitalRequestResponseStatusDto,
  ) {
    return this.bloodRequestsService.updateHospitalResponseStatus(id, responseId, user.id, user.role, dto);
  }

  @Roles(Role.HOSPITAL_ADMIN)
  @Post('hospital-active/:id/responses/:responseId/dispatch')
  dispatchHospitalTransfer(
    @Param('id') id: string,
    @Param('responseId') responseId: string,
    @CurrentUser() user: { id: string; role: Role },
    @Body() dto: DispatchHospitalBloodTransferDto,
  ) {
    return this.bloodRequestsService.dispatchHospitalTransfer(id, responseId, user.id, user.role, dto);
  }

  @Roles(Role.HOSPITAL_ADMIN)
  @Post('hospital-active/:id/responses/:responseId/receive')
  receiveHospitalTransfer(
    @Param('id') id: string,
    @Param('responseId') responseId: string,
    @CurrentUser() user: { id: string; role: Role },
    @Body() dto: ReceiveHospitalBloodTransferDto,
  ) {
    return this.bloodRequestsService.receiveHospitalTransfer(id, responseId, user.id, user.role, dto);
  }

  @Roles(Role.HOSPITAL_ADMIN, Role.ADMIN)
  @Post('escalation/check')
  runEscalationCheck(@CurrentUser() user: { id: string; role: Role }) {
    return this.bloodRequestsService.runEscalationCheck(user.id, user.role);
  }

  @Roles(
    Role.ADMIN,
    Role.ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.DONOR,
  )
  @Get(':id')
  getById(@Param('id') id: string, @CurrentUser() user: { id: string; role: Role }) {
    return this.bloodRequestsService.getById(id, user.id, user.role);
  }

  @Roles(Role.ADMIN, Role.HOSPITAL_ADMIN)
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
    Role.ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.DONOR,
  )
  @Get(':id/updates')
  listUpdates(@Param('id') id: string, @CurrentUser() user: { id: string; role: Role }, @Query() query: PaginationQueryDto) {
    return this.bloodRequestsService.listUpdates(id, user.id, user.role, query);
  }

  @Roles(Role.ADMIN, Role.HOSPITAL_ADMIN)
  @Post(':id/updates')
  createUpdate(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: Role },
    @Body() dto: CreateBloodRequestUpdateDto,
  ) {
    return this.bloodRequestsService.createUpdate(id, user.id, user.role, dto);
  }

  @Roles(Role.ADMIN)
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
    Role.ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.HOSPITAL_ADMIN,
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

