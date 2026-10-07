import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CatalogPrincipal } from './catalog-principal';

const REQUIRED_PERMISSIONS = 'required_catalog_permissions';
export const RequirePermissions = (...permissions: string[]) => SetMetadata(REQUIRED_PERMISSIONS, permissions);

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS, [
      context.getHandler(),
      context.getClass(),
    ]) ?? [];
    if (!required.length) return true;

    const principal = context.switchToHttp().getRequest<{ catalogPrincipal?: CatalogPrincipal }>().catalogPrincipal;
    if (!principal || !required.every((permission) => principal.permissions.includes(permission) || principal.permissions.includes('*'))) {
      throw new ForbiddenException('The caller does not have the required catalog permission');
    }
    return true;
  }
}
