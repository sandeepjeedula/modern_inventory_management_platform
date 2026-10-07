import { Global, Module } from '@nestjs/common';
import { OidcJwtGuard } from './oidc-jwt.guard';
import { OidcTokenVerifier } from './oidc-token-verifier';
import { PermissionsGuard } from './permissions.guard';

@Global()
@Module({ providers: [OidcTokenVerifier, OidcJwtGuard, PermissionsGuard], exports: [OidcTokenVerifier, OidcJwtGuard, PermissionsGuard] })
export class AuthModule {}
