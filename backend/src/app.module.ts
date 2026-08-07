import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import appConfig from './config/app.config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DonorsModule } from './modules/donors/donors.module';
import { HospitalsModule } from './modules/hospitals/hospitals.module';
import { BloodRequestsModule } from './modules/blood-requests/blood-requests.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReportsModule } from './modules/reports/reports.module';
import { WebsiteManagementModule } from './modules/website-management/website-management.module';
import { AdminDashboardModule } from './modules/admin-dashboard/admin-dashboard.module';
import { MapsModule } from './modules/maps/maps.module';
import { DonorClinicalRecordsModule } from './modules/donor-clinical-records/donor-clinical-records.module';
import { SmsModule } from './modules/sms/sms.module';
import { AdminDonorCommunicationsModule } from './modules/admin-donor-communications/admin-donor-communications.module';
import { DonorRemindersModule } from './modules/donor-reminders/donor-reminders.module';
import { AiIntelligenceModule } from './modules/ai-intelligence/ai-intelligence.module';
import { AssistantModule } from './modules/assistant/assistant.module';
import { CoreModule } from './core/core.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    CoreModule,
    ConfigModule.forRoot({ isGlobal: true, load: [appConfig] }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    AuthModule,
    UsersModule,
    DonorsModule,
    HospitalsModule,
    BloodRequestsModule,
    InventoryModule,
    AppointmentsModule,
    NotificationsModule,
    ReportsModule,
    WebsiteManagementModule,
    AdminDashboardModule,
    MapsModule,
    DonorClinicalRecordsModule,
    SmsModule,
    AdminDonorCommunicationsModule,
    DonorRemindersModule,
    AiIntelligenceModule,
    AssistantModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

