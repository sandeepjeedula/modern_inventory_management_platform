import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { OidcTokenVerifier } from './oidc-token-verifier';
import { CatalogPrincipal } from './catalog-principal';

type AuthenticatedRequest = Request & { catalogPrincipal?: CatalogPrincipal };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class OidcJwtGuard implements CanActivate {
  constructor(private readonly tokenVerifier: OidcTokenVerifier) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) throw new UnauthorizedException('A bearer access token is required');

    let payload;
    try {
      payload = await this.tokenVerifier.verify(token);
    } catch {
      throw new UnauthorizedException('The access token is invalid or expired');
    }

    const tenantId = typeof payload.tenant_id === 'string' ? payload.tenant_id : '';
    const subject = typeof payload.sub === 'string' ? payload.sub : '';
    if (!UUID_PATTERN.test(tenantId) || !subject) {
      throw new UnauthorizedException('The access token is missing a valid tenant identity');
    }

    const scopePermissions = typeof payload.scope === 'string' ? payload.scope.split(/\s+/) : [];
    const tokenPermissions = Array.isArray(payload.permissions)
      ? payload.permissions.filter((value): value is string => typeof value === 'string')
      : [];
    const realmAccess = payload.realm_access && typeof payload.realm_access === 'object'
      ? (payload.realm_access as { roles?: unknown }).roles
      : [];
    const realmPermissions = Array.isArray(realmAccess)
      ? realmAccess.filter((value): value is string => typeof value === 'string' && value.startsWith('catalog:'))
      : [];

    request.catalogPrincipal = {
      subject,
      tenantId,
      permissions: [...new Set([...scopePermissions, ...tokenPermissions, ...realmPermissions])],
    };
    return true;
  }
}
