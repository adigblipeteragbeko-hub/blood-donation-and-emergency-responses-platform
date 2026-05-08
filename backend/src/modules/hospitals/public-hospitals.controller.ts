import { Controller, Get, Query } from '@nestjs/common';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { HospitalsService } from './hospitals.service';

@Controller('public/centers')
export class PublicHospitalsController {
  constructor(private readonly hospitalsService: HospitalsService) {}

  @Get()
  list(@Query() query: PaginationQueryDto) {
    return this.hospitalsService.listPublicCenters(query);
  }
}
