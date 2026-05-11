import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionCode, Role } from '@prisma/client';
import {
  PERMISSIONS_KEY,
  PERMISSION_MODE_KEY,
  PermissionMode,
} from './permissions.decorator';
import { RbacService } from './rbac.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permissions = this.reflector.getAllAndOverride<PermissionCode[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!permissions || permissions.length === 0) {
      return true;
    }

    const mode =
      this.reflector.getAllAndOverride<PermissionMode>(PERMISSION_MODE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'all';

    const request = context.switchToHttp().getRequest<{ user?: { id: string; role: Role } }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const hasPermissions = await this.rbacService.userHasPermissions(
      user.id,
      user.role,
      permissions,
      mode,
    );

    if (!hasPermissions) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
