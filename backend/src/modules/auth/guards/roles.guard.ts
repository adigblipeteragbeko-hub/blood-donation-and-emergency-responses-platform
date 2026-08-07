import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import { AlertsService } from '../../../common/alerts/alerts.service';
import { SecurityEventsService } from '../../../common/security/security-events.service';
import { expandRoles } from '../../../common/rbac/permission-matrix';

const AUDIT_SENSITIVE_ROLES = new Set<Role>([
  Role.ADMIN,
  Role.ADMIN,
  Role.ADMIN,
  Role.ADMIN,
]);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly alerts: AlertsService,
    private readonly securityEvents: SecurityEventsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles || roles.length === 0) {
      return true;
    }

    const user = context.switchToHttp().getRequest().user;
    const expandedRoles = user?.role ? expandRoles(user.role) : [];

    if (!user || !roles.some((role) => expandedRoles.includes(role))) {
      if (roles.some((role) => AUDIT_SENSITIVE_ROLES.has(role))) {
        const request = context.switchToHttp().getRequest();
        this.alerts.notifySecurity('FAILED_ADMIN_ROUTE_ACCESS', {
          actorUserId: user?.id ?? null,
          actorRole: user?.role ?? null,
          path: request?.url ?? null,
          method: request?.method ?? null,
          ip: request?.ip ?? null,
        });
        await this.securityEvents.log({
          actorUserId: user?.id ?? null,
          email: user?.email ?? null,
          eventType: 'FAILED_ADMIN_ROUTE_ACCESS',
          severity: 'WARNING',
          description: `Unauthorized admin route access attempt on ${request?.url ?? 'unknown route'}.`,
          ipAddress: request?.ip ?? null,
          metadata: {
            actorRole: user?.role ?? null,
            path: request?.url ?? null,
            method: request?.method ?? null,
          },
        });
      }
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}

