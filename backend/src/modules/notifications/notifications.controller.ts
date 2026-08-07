import { Body, Controller, Get, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { NotificationsService } from './notifications.service';
import { UpdateNotificationStatusDto } from './dto/update-notification-status.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { RespondMobilizationCampaignDto } from './dto/respond-mobilization-campaign.dto';

@UseGuards(JwtAccessGuard, ActiveUserGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  listForUser(@CurrentUser() user: { id: string }, @Query() query: PaginationQueryDto) {
    return this.notificationsService.listForUser(user.id, query);
  }

  @Patch('delivery')
  markAsDelivered(@CurrentUser() user: { id: string }, @Body() dto: UpdateNotificationStatusDto) {
    return this.notificationsService.markAsDelivered(user.id, dto.notificationId, dto.delivered);
  }

  @Post('mobilization-response')
  respondToMobilizationCampaign(@CurrentUser() user: { id: string }, @Body() dto: RespondMobilizationCampaignDto) {
    return this.notificationsService.respondToMobilizationCampaign(user.id, dto);
  }
}
