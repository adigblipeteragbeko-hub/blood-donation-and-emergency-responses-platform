import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import { AlertsService } from '../../../common/alerts/alerts.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly alerts: AlertsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles || roles.length === 0) {
      return true;
    }

    const user = context.switchToHttp().getRequest().user;
    if (!user || !roles.includes(user.role)) {
      if (roles.includes(Role.ADMIN)) {
        const request = context.switchToHttp().getRequest();
        this.alerts.notifySecurity('FAILED_ADMIN_ROUTE_ACCESS', {
          actorUserId: user?.id ?? null,
          actorRole: user?.role ?? null,
          path: request?.url ?? null,
          method: request?.method ?? null,
          ip: request?.ip ?? null,
        });
      }
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
