import { Module } from '@nestjs/common';
import { MapsController } from './maps.controller';
import { PublicSmartBloodBanksController } from './public-smart-blood-banks.controller';
import { MapsService } from './maps.service';

@Module({
  controllers: [MapsController, PublicSmartBloodBanksController],
  providers: [MapsService],
})
export class MapsModule {}
