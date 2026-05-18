import { Controller, Get, Query } from '@nestjs/common';
import { MapsService } from './maps.service';
import { BloodBankQueryDto, NearestBloodSourceQueryDto } from './dto/blood-bank-query.dto';

@Controller('public/maps')
export class PublicSmartBloodBanksController {
  constructor(private readonly mapsService: MapsService) {}

  @Get('blood-banks')
  getBloodBanks(@Query() query: BloodBankQueryDto) {
    return this.mapsService.getSmartBloodBankMap(query);
  }

  @Get('nearest-blood-source')
  getNearestBloodSource(@Query() query: NearestBloodSourceQueryDto) {
    return this.mapsService.getNearestBloodSource(query);
  }
}
