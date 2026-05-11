import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(
    action: string,
    entityType: string,
    actorUserId?: string,
    entityId?: string,
    metadata?: unknown,
    description?: string,
    options?: {
      module?: string;
      ipAddress?: string;
      device?: string;
      oldValue?: unknown;
      newValue?: unknown;
    },
  ) {
    await this.prisma.auditLog.create({
      data: {
        action,
        entityType,
        actorUserId,
        entityId,
        metadata: metadata as object,
        description,
        module: options?.module,
        ipAddress: options?.ipAddress,
        device: options?.device,
        oldValue: (options?.oldValue as object | undefined) ?? undefined,
        newValue: (options?.newValue as object | undefined) ?? undefined,
      },
    });
    this.logger.log(
      JSON.stringify({
        action,
        entityType,
        actorUserId,
        entityId,
        description,
        module: options?.module,
      }),
    );
  }
}
