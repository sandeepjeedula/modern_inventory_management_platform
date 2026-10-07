import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify';
import { once } from 'node:events';
import { Response } from 'express';
import { DataSource } from 'typeorm';
import { CatalogPrincipal } from '../../auth/catalog-principal';
import { appendCatalogAudit } from './catalog-audit';
import { CatalogService } from './catalog.service';
import { CreateProductDto } from './dto/product.dto';
import { Product } from './entities/product.entity';

const CSV_COLUMNS = [
  'sku', 'name', 'description', 'categoryId', 'brand', 'productType', 'status', 'barcode', 'upc', 'ean', 'gtin',
  'unitOfMeasure', 'weight', 'dimensions', 'taxInformation', 'trackBatch', 'trackSerialNumber', 'trackExpiry',
];
const MAX_IMPORT_ROWS = 1000;
const EXPORT_PAGE_SIZE = 500;

@Injectable()
export class CatalogBulkService {
  constructor(private readonly dataSource: DataSource, private readonly catalog: CatalogService) {}

  async importCsv(principal: CatalogPrincipal, file: Express.Multer.File) {
    if (!file || !['text/csv', 'application/vnd.ms-excel', 'application/octet-stream'].includes(file.mimetype)) {
      throw new BadRequestException('Upload a CSV file');
    }
    if (file.size > 5 * 1024 * 1024) throw new BadRequestException('CSV file must be 5 MB or smaller');

    let records: Record<string, string>[];
    try {
      records = parse(file.buffer, { bom: true, columns: true, skip_empty_lines: true, trim: true, max_record_size: 100_000 });
    } catch {
      throw new BadRequestException('CSV could not be parsed');
    }
    if (!records.length) throw new BadRequestException('CSV contains no product rows');
    if (records.length > MAX_IMPORT_ROWS) throw new BadRequestException(`CSV may contain at most ${MAX_IMPORT_ROWS} rows`);
    const unknownColumns = Object.keys(records[0]).filter((column) => !CSV_COLUMNS.includes(column));
    if (unknownColumns.length) throw new BadRequestException(`Unsupported CSV columns: ${unknownColumns.join(', ')}`);

    const products: CreateProductDto[] = [];
    for (const [index, record] of records.entries()) {
      const row = index + 2;
      try {
        const raw = this.parseRecord(record);
        const dto = plainToInstance(CreateProductDto, raw);
        const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
        if (errors.length) {
          throw new BadRequestException(errors.flatMap((error) => Object.values(error.constraints ?? {})).join('; '));
        }
        products.push(dto);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid product data';
        throw new BadRequestException({ message: 'CSV validation failed', row, errors: [message] });
      }
    }

    try {
      await this.dataSource.transaction(async (manager) => {
        for (const [index, product] of products.entries()) {
          try {
            await this.catalog.createProductInTransaction(manager, principal, product);
          } catch (error) {
            const code = (error as { driverError?: { code?: string } }).driverError?.code;
            const row = index + 2;
            if (code === '23505') {
              throw new ConflictException({ message: 'CSV import rolled back', row, errors: ['Duplicate SKU or product identifier'] });
            }
            throw new BadRequestException({ message: 'CSV import rolled back', row, errors: ['Invalid category or product reference'] });
          }
        }
        await this.catalog.auditImport(manager, principal, products.length);
      });
    } catch (error) {
      if (error instanceof ConflictException || error instanceof BadRequestException) throw error;
      throw new ConflictException('CSV import was rolled back because one or more products conflict with existing catalog data');
    }

    return { imported: products.length };
  }

  async exportCsv(principal: CatalogPrincipal, response: Response): Promise<void> {
    await this.dataSource.transaction((manager) =>
      appendCatalogAudit(manager, principal, 'catalog.products.exported', 'product', null, {}),
    );
    response.status(200);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', 'attachment; filename="products.csv"');
    const output = stringify({ header: true, columns: CSV_COLUMNS });
    output.on('error', (error) => response.destroy(error));
    output.pipe(response);

    const repository = this.dataSource.getRepository(Product);
    let offset = 0;
    while (true) {
      const products = await repository.createQueryBuilder('product')
        .leftJoinAndSelect('product.identifiers', 'identifier')
        .where('product.tenant_id = :tenantId', { tenantId: principal.tenantId })
        .orderBy('product.id', 'ASC')
        .skip(offset)
        .take(EXPORT_PAGE_SIZE)
        .getMany();
      if (!products.length) break;
      for (const product of products) {
        const codes = new Map(product.identifiers.map((identifier) => [identifier.kind, identifier.code]));
        const accepted = output.write({
          sku: product.sku,
          name: product.name,
          description: product.description ?? '',
          categoryId: product.categoryId ?? '',
          brand: product.brand ?? '',
          productType: product.productType,
          status: product.status,
          barcode: codes.get('barcode') ?? '',
          upc: codes.get('upc') ?? '',
          ean: codes.get('ean') ?? '',
          gtin: codes.get('gtin') ?? '',
          unitOfMeasure: product.unitOfMeasure,
          weight: product.weight ?? '',
          dimensions: product.dimensions ? JSON.stringify(product.dimensions) : '',
          taxInformation: product.taxInformation ? JSON.stringify(product.taxInformation) : '',
          trackBatch: product.trackBatch,
          trackSerialNumber: product.trackSerialNumber,
          trackExpiry: product.trackExpiry,
        });
        if (!accepted) await once(output, 'drain');
      }
      offset += products.length;
      if (products.length < EXPORT_PAGE_SIZE) break;
    }
    output.end();
    await once(output, 'finish');
  }

  exportTemplate(response: Response): void {
    response.status(200);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', 'attachment; filename="products-template.csv"');
    response.send(`${CSV_COLUMNS.join(',')}\r\n`);
  }

  private parseRecord(record: Record<string, string>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const column of CSV_COLUMNS) {
      const value = record[column]?.trim();
      if (value === undefined || value === '') continue;
      if (['dimensions', 'taxInformation'].includes(column)) {
        result[column] = JSON.parse(value);
      } else if (['trackBatch', 'trackSerialNumber', 'trackExpiry'].includes(column)) {
        if (!['true', 'false'].includes(value.toLowerCase())) throw new Error(`${column} must be true or false`);
        result[column] = value.toLowerCase() === 'true';
      } else if (column === 'weight') {
        const weight = Number(value);
        if (!Number.isFinite(weight)) throw new Error('weight must be numeric');
        result[column] = weight;
      } else {
        result[column] = value;
      }
    }
    return result;
  }
}
