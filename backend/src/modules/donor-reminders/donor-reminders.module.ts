import { Module } from '@nestjs/common';
import { SmsModule } from '../sms/sms.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DonorRemindersController } from './donor-reminders.controller';
import { DonorSixMonthRemindersService } from './donor-six-month-reminders.service';

@Module({
  imports: [SmsModule, NotificationsModule],
  controllers: [DonorRemindersController],
  providers: [DonorSixMonthRemindersService],
})
export class DonorRemindersModule {}
