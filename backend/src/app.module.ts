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
import { CoreModule } from './core/core.module';

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
  ],
})
export class AppModule {}
