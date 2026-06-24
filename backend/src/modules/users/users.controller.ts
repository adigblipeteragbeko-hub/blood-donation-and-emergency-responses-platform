import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PermissionCode, Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/rbac/permissions.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserAdminDto } from './dto/admin/create-user-admin.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@UseGuards(JwtAccessGuard, RolesGuard, PermissionsGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Permissions([PermissionCode.PLATFORM_ANALYTICS_VIEW], 'any')
  findAll(@Query() query: PaginationQueryDto) {
    return this.usersService.findAll(query);
  }

  @Post()
  @Permissions([PermissionCode.HOSPITAL_STAFF_MANAGE, PermissionCode.RBAC_MANAGE], 'any')
  create(@Body() dto: CreateUserAdminDto, @CurrentUser() user: { id: string }) {
    return this.usersService.create(dto, user.id);
  }

  @Patch(':id')
  @Permissions([PermissionCode.HOSPITAL_STAFF_MANAGE, PermissionCode.RBAC_MANAGE], 'any')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.usersService.update(id, dto, user.id);
  }

  @Delete(':id')
  @Permissions([PermissionCode.PLATFORM_ANALYTICS_VIEW, PermissionCode.RBAC_MANAGE], 'any')
  remove(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.usersService.remove(id, user.id);
  }
}
