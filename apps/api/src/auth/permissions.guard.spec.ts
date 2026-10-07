import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
  const handler = {};
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(['catalog:write']),
  } as unknown as Reflector;
  const guard = new PermissionsGuard(reflector);

  function context(permissions: string[]): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ catalogPrincipal: { permissions } }) }),
    } as unknown as ExecutionContext;
  }

  it('allows a caller with the required permission', () => {
    expect(guard.canActivate(context(['catalog:read', 'catalog:write']))).toBe(true);
  });

  it('denies a caller without the required permission', () => {
    expect(() => guard.canActivate(context(['catalog:read']))).toThrow(ForbiddenException);
  });

  it('allows an explicit wildcard permission', () => {
    expect(guard.canActivate(context(['*']))).toBe(true);
  });
});
