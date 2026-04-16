import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuditService } from '../../common/audit/audit.service';

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
    return updated;
  }
}
