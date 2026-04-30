import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryChangeType, Role } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { CreateInventoryLogDto } from './dto/create-inventory-log.dto';
import { UpsertInventoryDto } from './dto/upsert-inventory.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { AuditService } from '../../common/audit/audit.service';
import { AlertsService } from '../../common/alerts/alerts.service';
import { RealtimeService } from '../../common/realtime/realtime.service';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly alerts: AlertsService,
    private readonly realtime: RealtimeService,
  ) {}

  private async getHospitalForUser(userId: string) {
    const hospital = await this.prisma.hospital.findUnique({ where: { userId } });
    if (!hospital) {
      throw new NotFoundException('Hospital profile not found');
    }
    return hospital;
  }

  private calculateUnits(previousUnits: number, unitsChanged: number, changeType: InventoryChangeType): number {
    if (changeType === InventoryChangeType.ADDED) {
      return previousUnits + unitsChanged;
    }

    if (changeType === InventoryChangeType.USED || changeType === InventoryChangeType.EXPIRED) {
      return previousUnits - unitsChanged;
    }

    return unitsChanged;
  }

  private getCriticalThreshold(bloodGroup: string): number {
    if (bloodGroup === 'O_NEG') {
      return 12;
    }
    if (bloodGroup === 'B_NEG' || bloodGroup === 'AB_NEG') {
      return 5;
    }
    return 8;
  }

  private async evaluateInventoryRisk(hospitalId: string, bloodGroup: string, availableUnits: number, actorUserId: string) {
    const criticalThreshold = this.getCriticalThreshold(bloodGroup);
    if (availableUnits <= criticalThreshold) {
      this.alerts.notifyCritical('INVENTORY_CRITICAL_THRESHOLD', {
        hospitalId,
        bloodGroup,
        availableUnits,
        criticalThreshold,
      });
      await this.audit.log('INVENTORY_CRITICAL_THRESHOLD', 'INVENTORY', actorUserId, hospitalId, {
        bloodGroup,
        availableUnits,
        criticalThreshold,
      });
    }
  }

  async upsert(userId: string, dto: UpsertInventoryDto) {
    const hospital = await this.getHospitalForUser(userId);

    const item = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.inventoryItem.findUnique({
        where: {
          hospitalId_bloodGroup: { hospitalId: hospital.id, bloodGroup: dto.bloodGroup },
        },
      });

      const updated = await tx.inventoryItem.upsert({
        where: {
          hospitalId_bloodGroup: { hospitalId: hospital.id, bloodGroup: dto.bloodGroup },
        },
        update: { availableUnits: dto.availableUnits, updatedById: userId },
        create: {
          hospitalId: hospital.id,
          bloodGroup: dto.bloodGroup,
          availableUnits: dto.availableUnits,
          updatedById: userId,
        },
      });

      await tx.inventoryLog.create({
        data: {
          inventoryId: updated.id,
          changeType: existing ? InventoryChangeType.ADJUSTED : InventoryChangeType.ADDED,
          unitsChanged: existing ? dto.availableUnits - existing.availableUnits : dto.availableUnits,
          previousUnits: existing?.availableUnits ?? 0,
          newUnits: dto.availableUnits,
          reason: existing ? 'Inventory set via upsert' : 'Initial inventory stock',
          changedById: userId,
        },
      });

      return updated;
    });

    await this.audit.log('INVENTORY_UPDATED', 'INVENTORY', userId, item.id, dto);
    await this.evaluateInventoryRisk(item.hospitalId, item.bloodGroup, item.availableUnits, userId);
    this.realtime.broadcastInventoryUpdate({
      inventoryId: item.id,
      hospitalId: item.hospitalId,
      bloodGroup: item.bloodGroup,
      availableUnits: item.availableUnits,
      updatedBy: userId,
    });
    return item;
  }

  async list(userId: string, role: Role) {
    if (role === Role.ADMIN) {
      return this.prisma.inventoryItem.findMany({
        include: {
          hospital: { select: { hospitalName: true, location: true } },
          updatedBy: { select: { email: true } },
        },
        orderBy: { lastUpdated: 'desc' },
      });
    }

    const hospital = await this.getHospitalForUser(userId);
    return this.prisma.inventoryItem.findMany({
      where: { hospitalId: hospital.id },
      include: {
        hospital: { select: { hospitalName: true, location: true } },
        updatedBy: { select: { email: true } },
      },
      orderBy: { lastUpdated: 'desc' },
    });
  }

  async updateItem(id: string, userId: string, role: Role, dto: UpdateInventoryItemDto) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id },
      include: { hospital: { select: { userId: true } } },
    });

    if (!item) {
      throw new NotFoundException('Inventory item not found');
    }

    if (role !== Role.ADMIN && item.hospital.userId !== userId) {
      throw new NotFoundException('Inventory item not found');
    }

    const previousUnits = item.availableUnits;
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.inventoryItem.update({
        where: { id },
        data: { availableUnits: dto.availableUnits, updatedById: userId },
      });

      await tx.inventoryLog.create({
        data: {
          inventoryId: id,
          changeType: InventoryChangeType.ADJUSTED,
          unitsChanged: dto.availableUnits - previousUnits,
          previousUnits,
          newUnits: dto.availableUnits,
          reason: dto.reason ?? 'Manual inventory update',
          changedById: userId,
        },
      });

      return next;
    });

    await this.audit.log('INVENTORY_ITEM_UPDATED', 'INVENTORY', userId, id, {
      previousUnits,
      newUnits: dto.availableUnits,
      reason: dto.reason,
    });
    await this.evaluateInventoryRisk(item.hospitalId, item.bloodGroup, updated.availableUnits, userId);
    this.realtime.broadcastInventoryUpdate({
      inventoryId: id,
      availableUnits: updated.availableUnits,
      updatedBy: userId,
    });
    return updated;
  }

  async listLogs(userId: string, role: Role) {
    if (role === Role.ADMIN) {
      return this.prisma.inventoryLog.findMany({
        include: {
          inventory: {
            include: {
              hospital: { select: { hospitalName: true, location: true } },
            },
          },
          changedBy: { select: { email: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    const hospital = await this.getHospitalForUser(userId);
    return this.prisma.inventoryLog.findMany({
      where: {
        inventory: { hospitalId: hospital.id },
      },
      include: {
        inventory: {
          include: {
            hospital: { select: { hospitalName: true, location: true } },
          },
        },
        changedBy: { select: { email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createLog(id: string, userId: string, role: Role, dto: CreateInventoryLogDto) {
    const inventory = await this.prisma.inventoryItem.findUnique({
      where: { id },
      include: { hospital: { select: { userId: true } } },
    });
    if (!inventory) {
      throw new NotFoundException('Inventory item not found');
    }

    if (role !== Role.ADMIN && inventory.hospital.userId !== userId) {
      throw new NotFoundException('Inventory item not found');
    }

    if (dto.unitsChanged < 0) {
      throw new BadRequestException('unitsChanged must be non-negative');
    }

    const previousUnits = inventory.availableUnits;
    const newUnits = this.calculateUnits(previousUnits, dto.unitsChanged, dto.changeType);
    if (newUnits < 0) {
      throw new BadRequestException('Inventory cannot be negative');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedInventory = await tx.inventoryItem.update({
        where: { id },
        data: { availableUnits: newUnits, updatedById: userId },
      });

      const log = await tx.inventoryLog.create({
        data: {
          inventoryId: id,
          changeType: dto.changeType,
          unitsChanged: dto.unitsChanged,
          previousUnits,
          newUnits,
          reason: dto.reason,
          changedById: userId,
        },
      });

      return { updatedInventory, log };
    });

    await this.audit.log('INVENTORY_LOG_CREATED', 'INVENTORY_LOG', userId, result.log.id, {
      inventoryId: id,
      changeType: dto.changeType,
      unitsChanged: dto.unitsChanged,
      previousUnits,
      newUnits,
    });
    await this.evaluateInventoryRisk(inventory.hospitalId, inventory.bloodGroup, result.updatedInventory.availableUnits, userId);

    this.realtime.broadcastInventoryUpdate({
      inventoryId: id,
      availableUnits: result.updatedInventory.availableUnits,
      changeType: dto.changeType,
      unitsChanged: dto.unitsChanged,
      updatedBy: userId,
    });

    return result;
  }
}
