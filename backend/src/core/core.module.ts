import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AlertsService } from '../common/alerts/alerts.service';
import { MailService } from '../common/mail/mail.service';
import { RealtimeGateway } from '../common/realtime/realtime.gateway';
import { RealtimeService } from '../common/realtime/realtime.service';

@Global()
@Module({
  providers: [PrismaService, AuditService, AlertsService, MailService, RealtimeGateway, RealtimeService],
  exports: [PrismaService, AuditService, AlertsService, MailService, RealtimeGateway, RealtimeService],
})
export class CoreModule {}
