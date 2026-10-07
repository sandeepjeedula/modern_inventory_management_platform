import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CatalogPrincipal } from './catalog-principal';

export const CurrentCatalogPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CatalogPrincipal =>
    context.switchToHttp().getRequest<{ catalogPrincipal: CatalogPrincipal }>().catalogPrincipal,
);
