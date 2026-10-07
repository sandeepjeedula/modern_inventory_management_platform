import { randomUUID } from 'node:crypto';
import { QueryRunner } from 'typeorm';
import dataSource from '../src/infrastructure/database/data-source';
import { ProductListQueryDto } from '../src/modules/catalog/dto/catalog-query.dto';
import { Category } from '../src/modules/catalog/entities/category.entity';
import { ProductVariant } from '../src/modules/catalog/entities/product-variant.entity';
import { Product } from '../src/modules/catalog/entities/product.entity';
import { CatalogRepository } from '../src/modules/catalog/catalog.repository';

describe('Catalog PostgreSQL constraints', () => {
  let runner: QueryRunner;
  let tenantId: string;
  let otherTenantId: string;

  beforeAll(async () => {
    if (!dataSource.isInitialized) await dataSource.initialize();
  });

  beforeEach(async () => {
    runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    tenantId = randomUUID();
    otherTenantId = randomUUID();
    await runner.query('INSERT INTO tenants (id, name, slug) VALUES ($1, $2, $3), ($4, $5, $6)', [
      tenantId, 'Catalog test', `catalog-${tenantId}`,
      otherTenantId, 'Other catalog test', `catalog-${otherTenantId}`,
    ]);
  });

  afterEach(async () => {
    if (runner.isTransactionActive) await runner.rollbackTransaction();
    await runner.release();
  });

  afterAll(async () => {
    if (dataSource.isInitialized) await dataSource.destroy();
  });

  async function createProduct(ownerTenantId: string, sku: string, categoryId: string | null = null) {
    const [product] = await runner.query(
      `INSERT INTO products (tenant_id, sku, name, category_id, created_by, updated_by)
       VALUES ($1, $2, $3, $4, 'catalog-test', 'catalog-test') RETURNING id`,
      [ownerTenantId, sku, sku, categoryId],
    );
    await runner.query(
      'INSERT INTO catalog_skus (tenant_id, product_id, normalized_sku) VALUES ($1, $2, $3)',
      [ownerTenantId, product.id, sku.toLowerCase()],
    );
    return product.id as string;
  }

  async function expectUniqueViolation(operation: () => Promise<unknown>) {
    await runner.query('SAVEPOINT expected_constraint');
    await expect(operation()).rejects.toMatchObject({ driverError: { code: '23505' } });
    await runner.query('ROLLBACK TO SAVEPOINT expected_constraint');
    await runner.query('RELEASE SAVEPOINT expected_constraint');
  }

  it('returns products only for the repository tenant scope', async () => {
    await createProduct(tenantId, 'TENANT-ONE');
    const productId = await createProduct(tenantId, 'WITH-VARIANT');
    await runner.query(
      `INSERT INTO product_variants (tenant_id, product_id, sku, created_by, updated_by)
       VALUES ($1, $2, 'WITH-VARIANT-S', 'test', 'test')`,
      [tenantId, productId],
    );
    await runner.query(
      'INSERT INTO catalog_skus (tenant_id, variant_id, normalized_sku) VALUES ($1, (SELECT id FROM product_variants WHERE product_id = $2), $3)',
      [tenantId, productId, 'with-variant-s'],
    );
    await createProduct(otherTenantId, 'TENANT-TWO');
    const repository = new CatalogRepository(
      runner.manager.getRepository(Product),
      runner.manager.getRepository(Category),
      runner.manager.getRepository(ProductVariant),
    );
    const [products, total] = await repository.listProducts(tenantId, new ProductListQueryDto());

    expect(total).toBe(2);
    expect(products.map((product) => product.sku)).toEqual(expect.arrayContaining(['WITH-VARIANT', 'TENANT-ONE']));
    expect(products.find((product) => product.id === productId)?.variantCount).toBe(1);

    const [variantSkuMatch] = await repository.listProducts(tenantId, Object.assign(new ProductListQueryDto(), { search: 'WITH-VARIANT-S' }));
    expect(variantSkuMatch).toHaveLength(1);
    expect(variantSkuMatch[0].id).toBe(productId);
  });

  it('rejects product categories owned by another tenant', async () => {
    const [category] = await runner.query(
      `INSERT INTO categories (tenant_id, name, created_by, updated_by)
       VALUES ($1, 'Other tenant category', 'test', 'test') RETURNING id`,
      [otherTenantId],
    );

    await runner.query('SAVEPOINT expected_constraint');
    await expect(runner.query(
      `INSERT INTO products (tenant_id, sku, name, category_id, created_by, updated_by)
       VALUES ($1, 'CROSS-TENANT', 'Cross tenant', $2, 'test', 'test')`,
      [tenantId, category.id],
    )).rejects.toMatchObject({ driverError: { code: '23503' } });
    await runner.query('ROLLBACK TO SAVEPOINT expected_constraint');
  });

  it('enforces SKU uniqueness across products and variants within a tenant', async () => {
    const productId = await createProduct(tenantId, 'SHARED-CODE');
    const [variant] = await runner.query(
      `INSERT INTO product_variants (tenant_id, product_id, sku, created_by, updated_by)
       VALUES ($1, $2, 'shared-code', 'test', 'test') RETURNING id`,
      [tenantId, productId],
    );

    await expectUniqueViolation(() => runner.query(
      `INSERT INTO catalog_skus (tenant_id, variant_id, normalized_sku) VALUES ($1, $2, 'shared-code')`,
      [tenantId, variant.id],
    ));
  });

  it('rejects duplicate product barcodes within a tenant', async () => {
    const firstProductId = await createProduct(tenantId, 'BARCODE-ONE');
    const secondProductId = await createProduct(tenantId, 'BARCODE-TWO');
    await runner.query(
      `INSERT INTO product_identifiers (tenant_id, product_id, kind, code)
       VALUES ($1, $2, 'barcode', '0123456789')`,
      [tenantId, firstProductId],
    );

    await expectUniqueViolation(() => runner.query(
      `INSERT INTO product_identifiers (tenant_id, product_id, kind, code)
       VALUES ($1, $2, 'barcode', '0123456789')`,
      [tenantId, secondProductId],
    ));
  });
});
