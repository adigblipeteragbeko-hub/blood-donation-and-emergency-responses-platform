import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuditService } from '../../common/audit/audit.service';
import { CreateUserAdminDto } from './dto/admin/create-user-admin.dto';
import * as argon2 from 'argon2';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.user.findMany({
      select: { id: true, email: true, role: true, isActive: true, createdAt: true },
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
    };
  }

  async remove(id: string, actorUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.delete({ where: { id } });
    await this.audit.log('USER_DELETED', 'USER', actorUserId, id, { email: user.email });

    return { message: 'User deleted successfully' };
  }
}
