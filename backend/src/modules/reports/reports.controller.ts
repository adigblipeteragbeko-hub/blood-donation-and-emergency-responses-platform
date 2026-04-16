import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ReportFilterDto } from './dto/report-filter.dto';
import { ReportsService } from './reports.service';

@UseGuards(JwtAccessGuard, ActiveUserGuard, RolesGuard)
@Roles(Role.ADMIN, Role.HOSPITAL_STAFF)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  summary(@Query() filter: ReportFilterDto) {
    return this.reportsService.summary(filter);
  }
}
