import { Module } from '@nestjs/common';
import { BloodRequestsController } from './blood-requests.controller';
import { BloodRequestsService } from './blood-requests.service';
import { DonorResponsesController } from './donor-responses.controller';
import { PublicBloodRequestsController } from './public-blood-requests.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { SmsModule } from '../sms/sms.module';

@Module({
  imports: [NotificationsModule, SmsModule],
  controllers: [BloodRequestsController, DonorResponsesController, PublicBloodRequestsController],
  providers: [BloodRequestsService],
  exports: [BloodRequestsService],
})
export class BloodRequestsModule {}
