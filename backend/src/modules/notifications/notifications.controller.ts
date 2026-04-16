import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { NotificationsService } from './notifications.service';
import { UpdateNotificationStatusDto } from './dto/update-notification-status.dto';

@UseGuards(JwtAccessGuard, ActiveUserGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  listForUser(@CurrentUser() user: { id: string }) {
    return this.notificationsService.listForUser(user.id);
  }

  @Patch('delivery')
  markAsDelivered(@CurrentUser() user: { id: string }, @Body() dto: UpdateNotificationStatusDto) {
    return this.notificationsService.markAsDelivered(user.id, dto.notificationId, dto.delivered);
  }
}
