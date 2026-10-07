import { BadRequestException, Controller, Get, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentCatalogPrincipal } from '../../auth/current-catalog-principal.decorator';
import { CatalogPrincipal } from '../../auth/catalog-principal';
import { OidcJwtGuard } from '../../auth/oidc-jwt.guard';
import { PermissionsGuard, RequirePermissions } from '../../auth/permissions.guard';
import { CatalogBulkService } from './catalog-bulk.service';

@ApiTags('catalog bulk operations')
@ApiBearerAuth()
@UseGuards(OidcJwtGuard, PermissionsGuard)
@Controller('catalog/products')
export class CatalogBulkController {
  constructor(private readonly bulk: CatalogBulkService) {}

  @Get('import-template.csv')
  @RequirePermissions('catalog:import')
  @ApiOperation({ summary: 'Download the supported product CSV headers' })
  template(@Res() response: Response) {
    return this.bulk.exportTemplate(response);
  }

  @Post('import')
  @RequirePermissions('catalog:import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] } })
  @ApiOperation({ summary: 'Validate and atomically import up to 1,000 products from CSV' })
  import(@CurrentCatalogPrincipal() principal: CatalogPrincipal, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('CSV file is required');
    return this.bulk.importCsv(principal, file);
  }

  @Get('export.csv')
  @RequirePermissions('catalog:export')
  @ApiOperation({ summary: 'Stream all tenant products as CSV' })
  export(@CurrentCatalogPrincipal() principal: CatalogPrincipal, @Res() response: Response) {
    return this.bulk.exportCsv(principal, response);
  }
}
