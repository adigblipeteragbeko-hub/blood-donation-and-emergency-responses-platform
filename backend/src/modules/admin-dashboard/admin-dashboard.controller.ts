import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { PermissionCode, Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Permissions } from '../../common/rbac/permissions.decorator';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminDashboardEmergencyQueryDto } from './dto/admin-dashboard-emergency-query.dto';
import { AdminDashboardActivityQueryDto } from './dto/admin-dashboard-activity-query.dto';
import { AdminDashboardDonorReviewQueryDto } from './dto/admin-dashboard-donor-review-query.dto';
import { UpdateDonorReviewDto } from './dto/update-donor-review.dto';
import { AdminDashboardAuditQueryDto } from './dto/admin-dashboard-audit-query.dto';
import { AdminDashboardSearchQueryDto } from './dto/admin-dashboard-search-query.dto';

@Controller('admin/dashboard')
@UseGuards(JwtAccessGuard, ActiveUserGuard, RolesGuard, PermissionsGuard)
@Roles(Role.ADMIN)
@Permissions(
  [
    PermissionCode.PLATFORM_ANALYTICS_VIEW,
    PermissionCode.AUDIT_LOG_VIEW,
    PermissionCode.SECURITY_MONITOR_VIEW,
  ],
  'any',
)
export class AdminDashboardController {
  constructor(private readonly adminDashboardService: AdminDashboardService) {}

  @Get('overview')
  getOverview() {
    return this.adminDashboardService.getOverview();
  }

  @Get('inventory-monitor')
  getInventoryMonitor() {
    return this.adminDashboardService.getInventoryMonitoring();
  }

  @Get('emergency-requests')
  getEmergencyRequests(@Query() query: AdminDashboardEmergencyQueryDto) {
    return this.adminDashboardService.getEmergencyMonitoring(query);
  }

  @Get('activity-feed')
  getActivityFeed(@Query() query: AdminDashboardActivityQueryDto) {
    return this.adminDashboardService.getActivityFeed(query);
  }

  @Get('notifications')
  getNotifications() {
    return this.adminDashboardService.getNotificationCenter();
  }

  @Get('donor-reviews')
  getDonorReviews(@Query() query: AdminDashboardDonorReviewQueryDto) {
    return this.adminDashboardService.getDonorReviewQueue(query);
  }

  @Patch('donor-reviews/:id')
  @Permissions([PermissionCode.DONOR_REVIEW_MANAGE, PermissionCode.DONOR_REVIEW_APPROVE], 'any')
  updateDonorReview(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateDonorReviewDto,
  ) {
    return this.adminDashboardService.updateDonorReview(id, user.id, dto);
  }

  @Get('audit-logs')
  getAuditLogs(@Query() query: AdminDashboardAuditQueryDto) {
    return this.adminDashboardService.getAuditLogs(query);
  }

  @Get('reports')
  getReports() {
    return this.adminDashboardService.getReports();
  }

  @Get('security')
  getSecurity() {
    return this.adminDashboardService.getSecurityMonitoring();
  }

  @Get('search')
  search(@Query() query: AdminDashboardSearchQueryDto) {
    return this.adminDashboardService.search(query);
  }
}

