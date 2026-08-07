import { Module } from '@nestjs/common';
import { SmsModule } from '../sms/sms.module';
import { AdminDonorCommunicationsController } from './admin-donor-communications.controller';
import { AdminDonorCommunicationsService } from './admin-donor-communications.service';

@Module({
  imports: [SmsModule],
  controllers: [AdminDonorCommunicationsController],
  providers: [AdminDonorCommunicationsService],
})
export class AdminDonorCommunicationsModule {}
