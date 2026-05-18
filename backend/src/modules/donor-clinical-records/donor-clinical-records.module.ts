import { Module } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { DonorClinicalRecordsController } from './donor-clinical-records.controller';
import { DonorClinicalRecordsService } from './donor-clinical-records.service';

@Module({
  imports: [CoreModule],
  controllers: [DonorClinicalRecordsController],
  providers: [DonorClinicalRecordsService],
})
export class DonorClinicalRecordsModule {}
