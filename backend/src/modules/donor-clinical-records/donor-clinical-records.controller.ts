import { Body, Controller, Get, Header, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DonorClinicalRecordsService } from './donor-clinical-records.service';
import {
  OfficeUseDto,
  ReviewQueueQueryDto,
  UpdateClinicalReviewDto,
  UpsertDonorClinicalDraftDto,
} from './dto/donor-clinical-record.dto';

@UseGuards(JwtAccessGuard, ActiveUserGuard, RolesGuard)
@Controller('donor-clinical-records')
export class DonorClinicalRecordsController {
  constructor(private readonly service: DonorClinicalRecordsService) {}

  @Roles(Role.DONOR)
  @Post('draft')
  saveDraft(@CurrentUser() user: { id: string }, @Body() dto: UpsertDonorClinicalDraftDto) {
    return this.service.saveDraft(user.id, dto);
  }

  @Roles(Role.DONOR)
  @Patch(':id/draft')
  updateDraft(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: UpsertDonorClinicalDraftDto) {
    return this.service.updateDraft(user.id, id, dto);
  }

  @Roles(Role.DONOR)
  @Post(':id/submit')
  submit(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.service.submit(user.id, id);
  }

  @Roles(Role.DONOR)
  @Get('me')
  me(@CurrentUser() user: { id: string }) {
    return this.service.getMine(user.id);
  }

  @Roles(Role.HOSPITAL_ADMIN, Role.ADMIN)
  @Get('review-queue')
  reviewQueue(@CurrentUser() user: { id: string; role: Role }, @Query() query: ReviewQueueQueryDto) {
    return this.service.reviewQueue(query, user);
  }

  @Roles(Role.DONOR, Role.HOSPITAL_ADMIN, Role.ADMIN)
  @Get(':id')
  getOne(@CurrentUser() user: { id: string; role: Role }, @Param('id') id: string) {
    return this.service.getById(id, user);
  }

  @Roles(Role.HOSPITAL_ADMIN, Role.ADMIN)
  @Patch(':id/review')
  review(@CurrentUser() user: { id: string; role: Role }, @Param('id') id: string, @Body() dto: UpdateClinicalReviewDto) {
    return this.service.startReview(id, dto, user);
  }

  @Roles(Role.HOSPITAL_ADMIN, Role.ADMIN)
  @Patch(':id/office-use')
  officeUse(@CurrentUser() user: { id: string; role: Role }, @Param('id') id: string, @Body() dto: OfficeUseDto) {
    return this.service.officeUse(id, dto, user);
  }

  @Roles(Role.DONOR, Role.HOSPITAL_ADMIN, Role.ADMIN)
  @Get(':id/pdf')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  async pdf(@CurrentUser() user: { id: string; role: Role }, @Param('id') id: string, @Res() res: Response) {
    const text = await this.service.pdfText(id, user);
    res.setHeader('Content-Disposition', `attachment; filename="donor-clinical-record-${id}.txt"`);
    return res.send(text);
  }
}

