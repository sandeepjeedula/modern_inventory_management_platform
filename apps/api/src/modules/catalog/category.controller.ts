import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentCatalogPrincipal } from '../../auth/current-catalog-principal.decorator';
import { CatalogPrincipal } from '../../auth/catalog-principal';
import { OidcJwtGuard } from '../../auth/oidc-jwt.guard';
import { PermissionsGuard, RequirePermissions } from '../../auth/permissions.guard';
import { CategoryService } from './category.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@ApiTags('catalog categories')
@ApiBearerAuth()
@UseGuards(OidcJwtGuard, PermissionsGuard)
@Controller('catalog/categories')
export class CategoryController {
  constructor(private readonly categories: CategoryService) {}

  @Get()
  @RequirePermissions('catalog:read')
  @ApiOperation({ summary: 'Get the tenant category tree' })
  list(@CurrentCatalogPrincipal() principal: CatalogPrincipal) {
    return this.categories.list(principal.tenantId);
  }

  @Post()
  @RequirePermissions('catalog:write')
  @ApiOperation({ summary: 'Create a category' })
  create(@CurrentCatalogPrincipal() principal: CatalogPrincipal, @Body() input: CreateCategoryDto) {
    return this.categories.create(principal, input);
  }

  @Patch(':id')
  @RequirePermissions('catalog:write')
  @ApiOperation({ summary: 'Edit, move, or deactivate a category' })
  update(
    @CurrentCatalogPrincipal() principal: CatalogPrincipal,
    @Param('id') id: string,
    @Body() input: UpdateCategoryDto,
  ) {
    return this.categories.update(principal, id, input);
  }
}
