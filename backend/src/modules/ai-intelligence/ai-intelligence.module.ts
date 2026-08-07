import { Module } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../prisma.service';
import { AiIntelligenceController } from './ai-intelligence.controller';
import { AiIntelligenceService } from './ai-intelligence.service';

@Module({
  controllers: [AiIntelligenceController],
  providers: [AiIntelligenceService, PrismaService, AuditService],
})
export class AiIntelligenceModule {}
