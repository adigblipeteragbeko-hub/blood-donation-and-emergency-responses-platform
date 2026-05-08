import { Controller, Get, Query } from '@nestjs/common';
import { BloodRequestsService } from './blood-requests.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@Controller('public/emergency-requests')
export class PublicBloodRequestsController {
  constructor(private readonly bloodRequestsService: BloodRequestsService) {}

  @Get()
  list(@Query() query: PaginationQueryDto) {
    return this.bloodRequestsService.listPublicEmergencyRequests(query);
  }
}
