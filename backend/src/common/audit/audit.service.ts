import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(action: string, entityType: string, actorUserId?: string, entityId?: string, metadata?: unknown) {
    await this.prisma.auditLog.create({
      data: { action, entityType, actorUserId, entityId, metadata: metadata as object },
    });
    this.logger.log(JSON.stringify({ action, entityType, actorUserId, entityId }));
  }
}
