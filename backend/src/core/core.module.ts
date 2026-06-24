import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AlertsService } from '../common/alerts/alerts.service';
import { MailService } from '../common/mail/mail.service';
import { RealtimeGateway } from '../common/realtime/realtime.gateway';
import { RealtimeService } from '../common/realtime/realtime.service';
import { ActivityService } from '../common/activity/activity.service';
import { SecurityEventsService } from '../common/security/security-events.service';
import { HospitalAccessService } from '../common/rbac/hospital-access.service';
import { RbacService } from '../common/rbac/rbac.service';
import { PermissionsGuard } from '../common/rbac/permissions.guard';
import { GeocodingService } from '../common/maps/geocoding.service';

@Global()
@Module({
  providers: [
    PrismaService,
    AuditService,
    AlertsService,
    MailService,
    RealtimeGateway,
    RealtimeService,
    ActivityService,
    SecurityEventsService,
    HospitalAccessService,
    RbacService,
    PermissionsGuard,
    GeocodingService,
  ],
  exports: [
    PrismaService,
    AuditService,
    AlertsService,
    MailService,
    RealtimeGateway,
    RealtimeService,
    ActivityService,
    SecurityEventsService,
    HospitalAccessService,
    RbacService,
    PermissionsGuard,
    GeocodingService,
  ],
})
export class CoreModule {}
