import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { BloodGroup, PermissionCode, Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { Permissions } from '../../common/rbac/permissions.decorator';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AiIntelligenceService } from './ai-intelligence.service';
import {
  AiDonorRecommendationQueryDto,
  AiHandoffDto,
  AiMobilizationPreviewDto,
  AiStockRiskQueryDto,
} from './dto/ai-intelligence.dto';

@Controller('ai-intelligence')
@UseGuards(JwtAccessGuard, ActiveUserGuard, RolesGuard, PermissionsGuard)
@Roles(Role.ADMIN, Role.HOSPITAL_ADMIN)
export class AiIntelligenceController {
  constructor(private readonly service: AiIntelligenceService) {}

  @Get('overview')
  @Permissions([PermissionCode.AI_INTELLIGENCE_VIEW])
  overview(@CurrentUser() user: { id: string; role: Role }, @Query() query: AiStockRiskQueryDto) {
    return this.service.overview(user, query);
  }

  @Get('stock-risks')
  @Permissions([PermissionCode.AI_STOCK_RISK_VIEW])
  stockRisks(@CurrentUser() user: { id: string; role: Role }, @Query() query: AiStockRiskQueryDto) {
    return this.service.stockRisks(user, query);
  }

  @Get('stock-risks/:hospitalId/:bloodGroup')
  @Permissions([PermissionCode.AI_STOCK_RISK_VIEW])
  stockRiskDetail(
    @CurrentUser() user: { id: string; role: Role },
    @Param('hospitalId') hospitalId: string,
    @Param('bloodGroup') bloodGroup: BloodGroup,
  ) {
    return this.service.stockRiskDetail(user, hospitalId, bloodGroup);
  }

  @Get('donor-recommendations')
  @Permissions([PermissionCode.AI_DONOR_RECOMMENDATION_VIEW])
  donorRecommendations(@CurrentUser() user: { id: string; role: Role }, @Query() query: AiDonorRecommendationQueryDto) {
    return this.service.donorRecommendations(user, query);
  }

  @Post('mobilization-preview')
  @Permissions([PermissionCode.AI_MOBILIZATION_PREVIEW])
  mobilizationPreview(@CurrentUser() user: { id: string; role: Role }, @Body() dto: AiMobilizationPreviewDto) {
    return this.service.mobilizationPreview(user, dto);
  }

  @Post('handoff')
  @Permissions([PermissionCode.AI_MOBILIZATION_PREVIEW])
  handoff(@CurrentUser() user: { id: string; role: Role }, @Body() dto: AiHandoffDto) {
    return this.service.handoff(user, dto);
  }

  @Get('history')
  @Permissions([PermissionCode.AI_RECOMMENDATION_HISTORY_VIEW])
  history(@CurrentUser() user: { id: string; role: Role }, @Query() query: AiStockRiskQueryDto) {
    return this.service.history(user, query);
  }
}
