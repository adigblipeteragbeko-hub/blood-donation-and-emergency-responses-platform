import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

type ActivityLogInput = {
  actorUserId?: string | null;
  actorName?: string | null;
  type: string;
  module: string;
  title: string;
  description: string;
  entityType?: string | null;
  entityId?: string | null;
  donorId?: string | null;
  hospitalId?: string | null;
  bloodRequestId?: string | null;
  metadata?: unknown;
};

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: ActivityLogInput) {
    return this.prisma.activityLog.create({
      data: {
        actorUserId: input.actorUserId ?? undefined,
        actorName: input.actorName ?? undefined,
        type: input.type,
        module: input.module,
        title: input.title,
        description: input.description,
        entityType: input.entityType ?? undefined,
        entityId: input.entityId ?? undefined,
        donorId: input.donorId ?? undefined,
        hospitalId: input.hospitalId ?? undefined,
        bloodRequestId: input.bloodRequestId ?? undefined,
        metadata: (input.metadata as object | undefined) ?? undefined,
      },
    });
  }
}
