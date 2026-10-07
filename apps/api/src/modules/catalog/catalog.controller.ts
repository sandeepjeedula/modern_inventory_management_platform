import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentCatalogPrincipal } from '../../auth/current-catalog-principal.decorator';
import { CatalogPrincipal } from '../../auth/catalog-principal';
import { OidcJwtGuard } from '../../auth/oidc-jwt.guard';
import { PermissionsGuard, RequirePermissions } from '../../auth/permissions.guard';
import { CatalogService } from './catalog.service';
import { ProductListQueryDto } from './dto/catalog-query.dto';
import { CreateProductDto, CreateVariantDto, UpdateProductDto, UpdateVariantDto } from './dto/product.dto';

@ApiTags('catalog products')
@ApiBearerAuth()
@UseGuards(OidcJwtGuard, PermissionsGuard)
@Controller('catalog/products')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @RequirePermissions('catalog:read')
  @ApiOperation({ summary: 'Search and list tenant products' })
  list(@CurrentCatalogPrincipal() principal: CatalogPrincipal, @Query() query: ProductListQueryDto) {
    return this.catalog.listProducts(principal.tenantId, query);
  }

  @Get('summary')
  @RequirePermissions('catalog:read')
  @ApiOperation({ summary: 'Get tenant catalog product and SKU totals' })
  summary(@CurrentCatalogPrincipal() principal: CatalogPrincipal) {
    return this.catalog.getSummary(principal.tenantId);
  }

  @Post()
  @RequirePermissions('catalog:write')
  @ApiOperation({ summary: 'Create a product' })
  create(@CurrentCatalogPrincipal() principal: CatalogPrincipal, @Body() input: CreateProductDto) {
    return this.catalog.createProduct(principal, input);
  }

  @Get(':id')
  @RequirePermissions('catalog:read')
  @ApiOperation({ summary: 'View product, variants, and image metadata' })
  get(@CurrentCatalogPrincipal() principal: CatalogPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.getProduct(principal.tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions('catalog:write')
  @ApiOperation({ summary: 'Edit a product' })
  update(
    @CurrentCatalogPrincipal() principal: CatalogPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateProductDto,
  ) {
    return this.catalog.updateProduct(principal, id, input);
  }

  @Post(':id/archive')
  @RequirePermissions('catalog:write')
  @ApiOperation({ summary: 'Archive a product without deleting catalog history' })
  archive(@CurrentCatalogPrincipal() principal: CatalogPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.setProductArchived(principal, id, true);
  }

  @Post(':id/restore')
  @RequirePermissions('catalog:write')
  @ApiOperation({ summary: 'Restore an archived product' })
  restore(@CurrentCatalogPrincipal() principal: CatalogPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.setProductArchived(principal, id, false);
  }

  @Get(':id/variants')
  @RequirePermissions('catalog:read')
  @ApiOperation({ summary: 'List product variants' })
  variants(@CurrentCatalogPrincipal() principal: CatalogPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.listVariants(principal.tenantId, id);
  }

  @Post(':id/variants')
  @RequirePermissions('catalog:write')
  @ApiOperation({ summary: 'Create a product variant' })
  createVariant(
    @CurrentCatalogPrincipal() principal: CatalogPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CreateVariantDto,
  ) {
    return this.catalog.createVariant(principal, id, input);
  }

  @Patch(':id/variants/:variantId')
  @RequirePermissions('catalog:write')
  @ApiOperation({ summary: 'Edit or archive a product variant' })
  updateVariant(
    @CurrentCatalogPrincipal() principal: CatalogPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() input: UpdateVariantDto,
  ) {
    return this.catalog.updateVariant(principal, id, variantId, input);
  }
}
