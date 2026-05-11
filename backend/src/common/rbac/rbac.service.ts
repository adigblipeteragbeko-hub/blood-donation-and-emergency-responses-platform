import { Injectable } from '@nestjs/common';
import { PermissionCode, Role } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { ROLE_PERMISSION_DEFAULTS, expandRoles } from './permission-matrix';

type PermissionCheckMode = 'all' | 'any';

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  async getRolePermissions(role: Role): Promise<PermissionCode[]> {
    const expandedRoles = expandRoles(role);
    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { role: { in: expandedRoles }, isGranted: true },
      select: { permission: true },
    });

    if (rolePermissions.length > 0) {
      return Array.from(new Set(rolePermissions.map((entry) => entry.permission)));
    }

    const defaults = expandedRoles.flatMap((entry) => ROLE_PERMISSION_DEFAULTS[entry] ?? []);
    return Array.from(new Set(defaults));
  }

  async getUserPermissions(userId: string, role: Role): Promise<PermissionCode[]> {
    const [basePermissions, overrides] = await Promise.all([
      this.getRolePermissions(role),
      this.prisma.userPermissionOverride.findMany({
        where: { userId },
        select: { permission: true, isGranted: true },
      }),
    ]);

    const granted = new Set(basePermissions);

    for (const override of overrides) {
      if (override.isGranted) {
        granted.add(override.permission);
      } else {
        granted.delete(override.permission);
      }
    }

    return Array.from(granted);
  }

  async userHasPermissions(
    userId: string,
    role: Role,
    permissions: PermissionCode[],
    mode: PermissionCheckMode = 'all',
  ): Promise<boolean> {
    if (permissions.length === 0) {
      return true;
    }

    const granted = new Set(await this.getUserPermissions(userId, role));

    return mode === 'any'
      ? permissions.some((permission) => granted.has(permission))
      : permissions.every((permission) => granted.has(permission));
  }
}
