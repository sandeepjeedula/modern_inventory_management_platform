import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentCatalogPrincipal } from '../../auth/current-catalog-principal.decorator';
import { CatalogPrincipal } from '../../auth/catalog-principal';
import { OidcJwtGuard } from '../../auth/oidc-jwt.guard';
import { PermissionsGuard, RequirePermissions } from '../../auth/permissions.guard';
import { ReorderProductImagesDto, UpdateProductImageDto } from './dto/product-image.dto';
import { ProductImageService } from './product-image.service';

@ApiTags('catalog product images')
@ApiBearerAuth()
@UseGuards(OidcJwtGuard, PermissionsGuard)
@Controller('catalog/products/:productId/images')
export class ProductImageController {
  constructor(private readonly images: ProductImageService) {}

  @Get()
  @RequirePermissions('catalog:read')
  @ApiOperation({ summary: 'List product images with short-lived read URLs' })
  list(
    @CurrentCatalogPrincipal() principal: CatalogPrincipal,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.images.list(principal.tenantId, productId);
  }

  @Post()
  @RequirePermissions('catalog:write')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, altText: { type: 'string' } }, required: ['file'] } })
  @ApiOperation({ summary: 'Upload a product image to configured object storage' })
  upload(
    @CurrentCatalogPrincipal() principal: CatalogPrincipal,
    @Param('productId', ParseUUIDPipe) productId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('altText') altText?: string,
  ) {
    if (altText !== undefined && typeof altText !== 'string') throw new BadRequestException('altText must be text');
    return this.images.upload(principal, productId, file!, altText);
  }

  @Get(':imageId/url')
  @RequirePermissions('catalog:read')
  @ApiOperation({ summary: 'Get a short-lived URL for a tenant-owned image' })
  readUrl(
    @CurrentCatalogPrincipal() principal: CatalogPrincipal,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.images.readUrl(principal.tenantId, productId, imageId);
  }

  @Patch('order')
  @RequirePermissions('catalog:write')
  @ApiOperation({ summary: 'Set the display order for every image on a product' })
  reorder(
    @CurrentCatalogPrincipal() principal: CatalogPrincipal,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() input: ReorderProductImagesDto,
  ) {
    return this.images.reorder(principal, productId, input);
  }

  @Patch(':imageId')
  @RequirePermissions('catalog:write')
  @ApiOperation({ summary: 'Set image alt text, display order, or primary image' })
  update(
    @CurrentCatalogPrincipal() principal: CatalogPrincipal,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Body() input: UpdateProductImageDto,
  ) {
    return this.images.update(principal, productId, imageId, input);
  }

  @Delete(':imageId')
  @RequirePermissions('catalog:write')
  @ApiOperation({ summary: 'Remove image metadata and its object' })
  remove(
    @CurrentCatalogPrincipal() principal: CatalogPrincipal,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.images.remove(principal, productId, imageId);
  }
}
