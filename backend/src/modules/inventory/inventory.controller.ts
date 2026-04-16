import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpsertInventoryDto } from './dto/upsert-inventory.dto';
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
  list(@CurrentUser() user: { id: string }) {
    return this.inventoryService.list(user.id);
  }
}
