import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateInventoryLogDto } from './dto/create-inventory-log.dto';
import { UpsertInventoryDto } from './dto/upsert-inventory.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { InventoryService } from './inventory.service';

@UseGuards(JwtAccessGuard, ActiveUserGuard, RolesGuard)
@Roles(Role.HOSPITAL_STAFF, Role.ADMIN)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
  upsert(@CurrentUser() user: { id: string }, @Body() dto: UpsertInventoryDto) {
    return this.inventoryService.upsert(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: { id: string; role: Role }) {
    return this.inventoryService.list(user.id, user.role);
  }

  @Patch(':id')
  updateItem(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: Role },
    @Body() dto: UpdateInventoryItemDto,
  ) {
    return this.inventoryService.updateItem(id, user.id, user.role, dto);
  }

  @Get('logs')
  listLogs(@CurrentUser() user: { id: string; role: Role }) {
    return this.inventoryService.listLogs(user.id, user.role);
  }

  @Post(':id/logs')
  createLog(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: Role },
    @Body() dto: CreateInventoryLogDto,
  ) {
    return this.inventoryService.createLog(id, user.id, user.role, dto);
  }
}
