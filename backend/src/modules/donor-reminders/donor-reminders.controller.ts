import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { PermissionCode, Role } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { Permissions } from '../../common/rbac/permissions.decorator';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DonorSixMonthRemindersService } from './donor-six-month-reminders.service';
import { SixMonthReminderPreviewDto, SixMonthReminderTestDto } from './dto/six-month-reminder.dto';

@Controller('admin/donor-reminders/six-month')
@UseGuards(JwtAccessGuard, ActiveUserGuard, RolesGuard, PermissionsGuard)
@Roles(Role.ADMIN)
export class DonorRemindersController {
  constructor(private readonly reminders: DonorSixMonthRemindersService) {}

  @Post('preview')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Permissions([PermissionCode.SMS_CAMPAIGN_VIEW])
  preview(@CurrentUser() user: { id: string; role: Role }, @Body() dto: SixMonthReminderPreviewDto) {
    return this.reminders.preview(user, dto.donorId);
  }

  @Post('test')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Permissions([PermissionCode.SMS_CAMPAIGN_MANAGE])
  test(
    @CurrentUser() user: { id: string; role: Role },
    @Body() dto: SixMonthReminderTestDto,
    @Req() _req: Request,
  ) {
    return this.reminders.sendTest(user, dto.donorId, dto.confirmSend === true);
  }
}
