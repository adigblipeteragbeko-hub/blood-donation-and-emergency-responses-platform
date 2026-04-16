import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AlertsService } from '../common/alerts/alerts.service';

@Global()
@Module({
  providers: [PrismaService, AuditService, AlertsService],
  exports: [PrismaService, AuditService, AlertsService],
})
export class CoreModule {}
