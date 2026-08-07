import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ManualVerificationMethod, NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuditService } from '../../common/audit/audit.service';
import { CreateUserAdminDto } from './dto/admin/create-user-admin.dto';
import * as argon2 from 'argon2';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll(query: PaginationQueryDto) {
    const skip = query.skip ?? 0;
    const take = query.take ?? 100;
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        emailVerified: true,
        verifiedAt: true,
        verificationMethod: true,
        verificationReason: true,
        createdAt: true,
        emailVerificationAttempts: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            status: true,
            provider: true,
            failureReason: true,
            sentAt: true,
            failedAt: true,
            createdAt: true,
          },
        },
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, dto: UpdateUserDto, actorUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.user.update({ where: { id }, data: dto });
    await this.audit.log('USER_UPDATED', 'USER', actorUserId, id, dto);
    return {
      id: updated.id,
      email: updated.email,
      role: updated.role,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      emailVerified: updated.emailVerified,
      verifiedAt: updated.verifiedAt,
    };
  }

  async create(dto: CreateUserAdminDto, actorUserId: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new BadRequestException('Email already exists');
    }

    const created = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: await argon2.hash(dto.password),
        role: dto.role,
        emailVerified: true,
        isActive: dto.isActive ?? true,
      },
    });

    await this.audit.log('USER_CREATED', 'USER', actorUserId, created.id, { email: dto.email, role: dto.role });

    return {
      id: created.id,
      email: created.email,
      role: created.role,
      isActive: created.isActive,
      createdAt: created.createdAt,
      emailVerified: created.emailVerified,
      verifiedAt: created.verifiedAt,
    };
  }

  async manualVerify(
    id: string,
    actorUserId: string,
    dto: { method: ManualVerificationMethod; reason: string; note?: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.emailVerified) {
      return {
        message: 'User is already verified.',
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          emailVerified: true,
          verifiedAt: user.verifiedAt,
        },
      };
    }

    const verifiedAt = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.user.update({
        where: { id },
        data: {
          emailVerified: true,
          verifiedAt,
          verifiedByAdminId: actorUserId,
          verificationMethod: dto.method,
          verificationReason: dto.reason,
          verificationNote: dto.note?.trim() || null,
        },
      });

      await tx.emailVerificationAttempt.updateMany({
        where: { userId: id, verifiedAt: null },
        data: { status: 'VERIFIED', verifiedAt },
      });

      await tx.emailVerificationToken.updateMany({
        where: { userId: id, usedAt: null },
        data: { usedAt: verifiedAt },
      });

      await tx.notification.create({
        data: {
          userId: id,
          title: 'Account verified',
          body: 'Your account has been manually verified by an administrator. You can now sign in.',
          channel: 'IN_APP',
          type: NotificationType.SYSTEM,
          delivered: false,
        },
      });

      return next;
    });

    await this.audit.log('DONOR_MANUALLY_VERIFIED', 'USER', actorUserId, id, {
      maskedEmail: this.maskEmail(user.email),
      method: dto.method,
      reason: dto.reason,
    });

    return {
      message: 'User verified successfully.',
      user: {
        id: updated.id,
        email: updated.email,
        role: updated.role,
        emailVerified: updated.emailVerified,
        verifiedAt: updated.verifiedAt,
      },
    };
  }

  private maskEmail(email: string) {
    const [name, domain] = email.split('@');
    if (!domain) return '***';
    return `${name.slice(0, 1)}***@${domain}`;
  }

  async remove(id: string, actorUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (id === actorUserId) {
      throw new ForbiddenException('You cannot delete the currently logged-in admin account.');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.donorResponse.updateMany({
          where: { userId: id },
          data: { userId: null },
        });

        await tx.user.delete({ where: { id } });
      });

      await this.audit.log('USER_DELETED', 'USER', actorUserId, id, {
        email: user.email,
        role: user.role,
      });
    } catch (error) {
      this.logger.error(
        `Failed to delete user ${id} (${user.email}): ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new BadRequestException('Unable to delete user because related records exist.');
      }

      throw error;
    }

    return { message: 'User deleted successfully' };
  }
}
