import { Controller, Get, INestApplication, UseGuards } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtPayload } from 'jsonwebtoken';
import * as request from 'supertest';
import { CurrentCatalogPrincipal } from '../src/auth/current-catalog-principal.decorator';
import { CatalogPrincipal } from '../src/auth/catalog-principal';
import { OidcJwtGuard } from '../src/auth/oidc-jwt.guard';
import { OidcTokenVerifier } from '../src/auth/oidc-token-verifier';
import { PermissionsGuard, RequirePermissions } from '../src/auth/permissions.guard';

@Controller('catalog-auth-test')
@UseGuards(OidcJwtGuard, PermissionsGuard)
class CatalogAuthorizationTestController {
  @Get()
  @RequirePermissions('catalog:read')
  currentTenant(@CurrentCatalogPrincipal() principal: CatalogPrincipal) {
    return { tenantId: principal.tenantId };
  }
}

describe('Catalog authorization API', () => {
  let app: INestApplication;
  const verify = jest.fn<Promise<JwtPayload>, [string]>();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CatalogAuthorizationTestController],
      providers: [{ provide: OidcTokenVerifier, useValue: { verify } }, PermissionsGuard, OidcJwtGuard],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => app?.close());
  beforeEach(() => verify.mockReset());

  it('rejects missing and invalid bearer tokens', async () => {
    await request(app.getHttpServer()).get('/catalog-auth-test').expect(401);
    verify.mockRejectedValueOnce(new Error('signature invalid'));
    await request(app.getHttpServer()).get('/catalog-auth-test').set('Authorization', 'Bearer bad').expect(401);
  });

  it('rejects tokens without a tenant UUID', async () => {
    verify.mockResolvedValueOnce({ sub: 'user-1', tenant_id: 'tenant-one', permissions: ['catalog:read'] });
    await request(app.getHttpServer()).get('/catalog-auth-test').set('Authorization', 'Bearer signed').expect(401);
  });

  it('forbids valid tenant tokens without catalog permission', async () => {
    verify.mockResolvedValueOnce({
      sub: 'user-1',
      tenant_id: '11111111-1111-4111-8111-111111111111',
      permissions: ['catalog:write'],
    });
    await request(app.getHttpServer()).get('/catalog-auth-test').set('Authorization', 'Bearer signed').expect(403);
  });

  it('derives the tenant exclusively from the verified token claim', async () => {
    const tenantId = '11111111-1111-4111-8111-111111111111';
    verify.mockResolvedValueOnce({ sub: 'user-1', tenant_id: tenantId, scope: 'catalog:read' });
    await request(app.getHttpServer())
      .get('/catalog-auth-test')
      .set('Authorization', 'Bearer signed')
      .set('x-tenant-id', '22222222-2222-4222-8222-222222222222')
      .expect(200)
      .expect({ tenantId });
  });
});
