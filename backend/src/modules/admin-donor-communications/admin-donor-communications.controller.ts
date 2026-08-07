import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { PermissionCode, Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { Permissions } from '../../common/rbac/permissions.decorator';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminDonorCommunicationsService } from './admin-donor-communications.service';
import {
  DonorContactsQueryDto,
  ExportDonorContactsDto,
  LaunchSmsCampaignDto,
  PreviewBulkSmsDto,
} from './dto/donor-communications.dto';

@Controller('admin/donor-communications')
@UseGuards(JwtAccessGuard, ActiveUserGuard, RolesGuard, PermissionsGuard)
@Roles(Role.ADMIN)
export class AdminDonorCommunicationsController {
  constructor(private readonly service: AdminDonorCommunicationsService) {}

  @Get('donors')
  @Permissions([PermissionCode.DONOR_CONTACT_VIEW])
  listDonors(@CurrentUser() user: { id: string; role: Role }, @Query() query: DonorContactsQueryDto) {
    return this.service.listDonors(user, query);
  }

  @Post('export')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Permissions([PermissionCode.DONOR_CONTACT_EXPORT])
  async exportContacts(
    @CurrentUser() user: { id: string; role: Role },
    @Body() dto: ExportDonorContactsDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.service.exportContacts(user, dto, req.ip);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.content);
  }

  @Post('sms/preview')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Permissions([PermissionCode.SMS_CAMPAIGN_VIEW])
  previewSms(@CurrentUser() user: { id: string; role: Role }, @Body() dto: PreviewBulkSmsDto) {
    return this.service.previewSms(user, dto);
  }

  @Post('sms/campaigns')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Permissions([PermissionCode.SMS_CAMPAIGN_MANAGE])
  launchCampaign(
    @CurrentUser() user: { id: string; role: Role },
    @Body() dto: LaunchSmsCampaignDto,
    @Req() req: Request,
  ) {
    return this.service.launchCampaign(user, dto, req.ip);
  }

  @Get('sms/campaigns')
  @Permissions([PermissionCode.SMS_CAMPAIGN_VIEW])
  listCampaigns(@CurrentUser() user: { id: string; role: Role }, @Query() query: Record<string, string | undefined>) {
    return this.service.listCampaigns(user, query);
  }

  @Get('sms/campaigns/:id')
  @Permissions([PermissionCode.SMS_CAMPAIGN_VIEW])
  getCampaign(@CurrentUser() user: { id: string; role: Role }, @Param('id') id: string) {
    return this.service.getCampaign(user, id);
  }
}
