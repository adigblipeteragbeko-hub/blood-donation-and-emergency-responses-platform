import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { WebsiteAnnouncementsService } from './website-announcements.service';

@Controller('announcements')
@UseGuards(JwtAccessGuard, ActiveUserGuard, RolesGuard)
@Roles(Role.ADMIN, Role.DONOR, Role.HOSPITAL_STAFF)
export class AnnouncementsController {
  constructor(private readonly announcementsService: WebsiteAnnouncementsService) {}

  @Get()
  listForUser(@CurrentUser() user: { id: string }) {
    return this.announcementsService.listAnnouncementsForUser(user.id);
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.announcementsService.markAsRead(user.id, id);
  }

  @Post('read-all')
  markAllAsRead(@CurrentUser() user: { id: string }) {
    return this.announcementsService.markAllAsRead(user.id);
  }
}
