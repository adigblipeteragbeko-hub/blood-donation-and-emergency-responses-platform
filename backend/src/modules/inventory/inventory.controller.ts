import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PermissionCode, Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Permissions } from '../../common/rbac/permissions.decorator';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { CreateInventoryLogDto } from './dto/create-inventory-log.dto';
import { UpsertInventoryDto } from './dto/upsert-inventory.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { InventoryService } from './inventory.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@UseGuards(JwtAccessGuard, ActiveUserGuard, RolesGuard, PermissionsGuard)
@Roles(Role.HOSPITAL_STAFF, Role.HOSPITAL_STAFF, Role.BLOOD_BANK_OFFICER, Role.ADMIN, Role.SUPER_ADMIN)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
  @Permissions([PermissionCode.INVENTORY_MANAGE])
  upsert(@CurrentUser() user: { id: string }, @Body() dto: UpsertInventoryDto) {
    return this.inventoryService.upsert(user.id, dto);
  }

  @Get()
  @Permissions([PermissionCode.INVENTORY_REPORT_VIEW])
  list(@CurrentUser() user: { id: string; role: Role }, @Query() query: PaginationQueryDto) {
    return this.inventoryService.list(user.id, user.role, query);
  }

  @Get('logs')
  @Permissions([PermissionCode.INVENTORY_REPORT_VIEW])
  listLogs(@CurrentUser() user: { id: string; role: Role }, @Query() query: PaginationQueryDto) {
    return this.inventoryService.listLogs(user.id, user.role, query);
  }

  @Patch(':id')
  @Permissions([PermissionCode.INVENTORY_MANAGE])
  updateItem(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: Role },
    @Body() dto: UpdateInventoryItemDto,
  ) {
    return this.inventoryService.updateItem(id, user.id, user.role, dto);
  }

  @Post(':id/logs')
  @Permissions([PermissionCode.INVENTORY_MANAGE])
  createLog(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: Role },
    @Body() dto: CreateInventoryLogDto,
  ) {
    return this.inventoryService.createLog(id, user.id, user.role, dto);
  }
}

