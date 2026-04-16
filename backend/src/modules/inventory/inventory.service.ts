import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { UpsertInventoryDto } from './dto/upsert-inventory.dto';
import { AuditService } from '../../common/audit/audit.service';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async upsert(userId: string, dto: UpsertInventoryDto) {
    const hospital = await this.prisma.hospital.findUnique({ where: { userId } });
    if (!hospital) {
      throw new NotFoundException('Hospital profile not found');
    }

    const item = await this.prisma.inventoryItem.upsert({
      where: {
        hospitalId_bloodGroup: { hospitalId: hospital.id, bloodGroup: dto.bloodGroup },
      },
      update: { availableUnits: dto.availableUnits },
      create: {
        hospitalId: hospital.id,
        bloodGroup: dto.bloodGroup,
        availableUnits: dto.availableUnits,
      },
    });

    await this.audit.log('INVENTORY_UPDATED', 'INVENTORY', userId, item.id, dto);
    return item;
  }

  async list(userId: string) {
    const hospital = await this.prisma.hospital.findUnique({ where: { userId } });
    if (!hospital) {
      throw new NotFoundException('Hospital profile not found');
    }

    return this.prisma.inventoryItem.findMany({ where: { hospitalId: hospital.id } });
  }
}
