import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AlertsService } from '../common/alerts/alerts.service';
import { MailService } from '../common/mail/mail.service';

@Global()
@Module({
  providers: [PrismaService, AuditService, AlertsService, MailService],
  exports: [PrismaService, AuditService, AlertsService, MailService],
})
export class CoreModule {}
