import { BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { CatalogPrincipal } from '../../auth/catalog-principal';
import { CatalogService } from './catalog.service';
import { CatalogBulkService } from './catalog-bulk.service';

describe('CatalogBulkService CSV import', () => {
  const principal: CatalogPrincipal = {
    subject: 'catalog-admin',
    tenantId: '11111111-1111-4111-8111-111111111111',
    permissions: ['catalog:import'],
  };
  const manager = {} as EntityManager;
  const dataSource = {
    transaction: jest.fn((operation: (manager: EntityManager) => unknown) => operation(manager)),
  } as unknown as DataSource;
  const catalog = {
    createProductInTransaction: jest.fn(),
    auditImport: jest.fn(),
  } as unknown as CatalogService;
  const service = new CatalogBulkService(dataSource, catalog);

  function csvFile(content: string): Express.Multer.File {
    const buffer = Buffer.from(content);
    return { buffer, size: buffer.length, mimetype: 'text/csv' } as Express.Multer.File;
  }

  beforeEach(() => jest.clearAllMocks());

  it('rejects unsupported CSV columns before writing', async () => {
    await expect(service.importCsv(principal, csvFile('sku,name,tenantId\nA-1,Widget,other')))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('reports validation failures with their source row', async () => {
    await expect(service.importCsv(principal, csvFile('sku,name,upc\nA-1,Widget,1234')))
      .rejects.toMatchObject({ response: { row: 2, message: 'CSV validation failed' } });
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('imports validated records in one tenant-scoped transaction', async () => {
    const result = await service.importCsv(principal, csvFile('sku,name,brand\nA-1,Widget,Tools\nA-2,Gadget,Tools'));

    expect(result).toEqual({ imported: 2 });
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(catalog.createProductInTransaction).toHaveBeenCalledTimes(2);
    expect(catalog.createProductInTransaction).toHaveBeenNthCalledWith(1, manager, principal, expect.objectContaining({ sku: 'A-1', name: 'Widget' }));
    expect(catalog.auditImport).toHaveBeenCalledWith(manager, principal, 2);
  });
});
