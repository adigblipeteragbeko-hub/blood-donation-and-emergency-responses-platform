import { applyDecorators, SetMetadata } from '@nestjs/common';
import { PermissionCode } from '@prisma/client';

export const PERMISSIONS_KEY = 'permissions';
export const PERMISSION_MODE_KEY = 'permission_mode';

export type PermissionMode = 'all' | 'any';

export function Permissions(permissions: PermissionCode[], mode: PermissionMode = 'all') {
  return applyDecorators(
    SetMetadata(PERMISSIONS_KEY, permissions),
    SetMetadata(PERMISSION_MODE_KEY, mode),
  );
}
