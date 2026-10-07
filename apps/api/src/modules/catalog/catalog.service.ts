import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { CatalogPrincipal } from '../../auth/catalog-principal';
import { CatalogRepository } from './catalog.repository';
import { ProductListQueryDto } from './dto/catalog-query.dto';
import { CreateProductDto, CreateVariantDto, ProductIdentifiersDto, UpdateProductDto, UpdateVariantDto } from './dto/product.dto';
import { Category } from './entities/category.entity';
import { ProductIdentifier, ProductIdentifierType } from './entities/product-identifier.entity';
import { Product } from './entities/product.entity';
import { ProductVariant } from './entities/product-variant.entity';
import { appendCatalogAudit } from './catalog-audit';
import { mapProduct, mapVariant } from './product-response';

const PRODUCT_IDENTIFIER_FIELDS: Array<[ProductIdentifierType, keyof ProductIdentifiersDto]> = [
  ['barcode', 'barcode'],
  ['upc', 'upc'],
  ['ean', 'ean'],
  ['gtin', 'gtin'],
];

@Injectable()
export class CatalogService {
  constructor(
    private readonly catalog: CatalogRepository,
    private readonly dataSource: DataSource,
  ) {}

  async listProducts(tenantId: string, query: ProductListQueryDto) {
    const [products, total] = await this.catalog.listProducts(tenantId, query);
    return {
      data: products.map(mapProduct),
      meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
    };
  }

  async getSummary(tenantId: string) {
    const [summary] = await this.dataSource.query(
      `SELECT
         (SELECT COUNT(*) FROM products WHERE tenant_id = $1 AND status <> 'archived')::int AS active_products,
         (SELECT COUNT(*) FROM catalog_skus WHERE tenant_id = $1)::int AS total_skus,
         (SELECT COUNT(*) FROM categories WHERE tenant_id = $1 AND status = 'active')::int AS active_categories`,
      [tenantId],
    ) as Array<{ active_products: number; total_skus: number; active_categories: number }>;
    return {
      activeProducts: Number(summary.active_products),
      totalSkus: Number(summary.total_skus),
      activeCategories: Number(summary.active_categories),
    };
  }

  async getProduct(tenantId: string, productId: string) {
    const product = await this.catalog.findProduct(tenantId, productId);
    if (!product) throw new NotFoundException('Product not found');
    return mapProduct(product);
  }

  async createProduct(principal: CatalogPrincipal, input: CreateProductDto) {
    const productId = await this.withConstraintHandling(() => this.dataSource.transaction(async (manager) => {
      await this.assertActiveCategory(manager, principal.tenantId, input.categoryId);
      const repository = manager.getRepository(Product);
      const product = repository.create(this.productFields(input, principal.subject));
      product.tenantId = principal.tenantId;
      product.sku = this.normalizeSku(input.sku);
      product.name = input.name.trim();
      product.createdBy = principal.subject;
      product.updatedBy = principal.subject;
      const saved = await repository.save(product);
      await this.insertSku(manager, principal.tenantId, saved.id, null, saved.sku);
      await this.replaceProductIdentifiers(manager, principal.tenantId, saved.id, input);
      await appendCatalogAudit(manager, principal, 'catalog.product.created', 'product', saved.id, { sku: saved.sku });
      return saved.id;
    }));
    return this.getProduct(principal.tenantId, productId);
  }

  async updateProduct(principal: CatalogPrincipal, productId: string, input: UpdateProductDto) {
    await this.withConstraintHandling(() => this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Product);
      const product = await repository.findOne({ where: { tenantId: principal.tenantId, id: productId } });
      if (!product) throw new NotFoundException('Product not found');
      if (product.status === 'archived') throw new ConflictException('Restore the product before editing it');
      if (input.categoryId !== undefined) await this.assertActiveCategory(manager, principal.tenantId, input.categoryId);

      const oldSku = product.sku;
      Object.assign(product, this.productFields(input, principal.subject));
      if (input.sku !== undefined) product.sku = this.normalizeSku(input.sku);
      if (input.name !== undefined) product.name = input.name.trim();
      product.updatedBy = principal.subject;
      await repository.save(product);

      if (input.sku !== undefined && product.sku !== oldSku) {
        await manager.query(
          'UPDATE catalog_skus SET normalized_sku = $3 WHERE tenant_id = $1 AND product_id = $2',
          [principal.tenantId, product.id, product.sku.toLowerCase()],
        );
      }
      if (PRODUCT_IDENTIFIER_FIELDS.some(([, field]) => input[field] !== undefined)) {
        await this.replaceProductIdentifiers(manager, principal.tenantId, product.id, input, true);
      }
      await appendCatalogAudit(manager, principal, 'catalog.product.updated', 'product', product.id, {
        previousSku: oldSku,
        fields: Object.keys(input),
      });
    }));
    return this.getProduct(principal.tenantId, productId);
  }

  async setProductArchived(principal: CatalogPrincipal, productId: string, archived: boolean) {
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Product);
      const product = await repository.findOne({ where: { tenantId: principal.tenantId, id: productId } });
      if (!product) throw new NotFoundException('Product not found');
      if (archived) {
        if (product.status !== 'archived') product.archivedFromStatus = product.status;
        product.status = 'archived';
        product.archivedAt = new Date();
      } else {
        product.status = product.archivedFromStatus ?? 'active';
        product.archivedFromStatus = null;
        product.archivedAt = null;
      }
      product.updatedBy = principal.subject;
      await repository.save(product);
      await appendCatalogAudit(
        manager,
        principal,
        archived ? 'catalog.product.archived' : 'catalog.product.restored',
        'product',
        product.id,
        { sku: product.sku },
      );
    });
    return this.getProduct(principal.tenantId, productId);
  }

  async listVariants(tenantId: string, productId: string) {
    const product = await this.catalog.findProduct(tenantId, productId);
    if (!product) throw new NotFoundException('Product not found');
    return { data: product.variants?.map(mapVariant) ?? [] };
  }

  async createVariant(principal: CatalogPrincipal, productId: string, input: CreateVariantDto) {
    const variantId = await this.withConstraintHandling(() => this.dataSource.transaction(async (manager) => {
      const product = await manager.getRepository(Product).findOne({ where: { tenantId: principal.tenantId, id: productId } });
      if (!product || product.status === 'archived') throw new NotFoundException('Active product not found');

      const repository = manager.getRepository(ProductVariant);
      const variant = repository.create({
        tenantId: principal.tenantId,
        productId,
        sku: this.normalizeSku(input.sku),
        attributes: input.attributes,
        price: input.price == null ? null : String(input.price),
        cost: input.cost == null ? null : String(input.cost),
        createdBy: principal.subject,
        updatedBy: principal.subject,
      });
      const saved = await repository.save(variant);
      await this.insertSku(manager, principal.tenantId, null, saved.id, saved.sku);
      if (input.barcode?.trim()) await this.insertVariantBarcode(manager, principal.tenantId, saved.id, input.barcode);
      await appendCatalogAudit(manager, principal, 'catalog.variant.created', 'product_variant', saved.id, { productId, sku: saved.sku });
      return saved.id;
    }));
    const variant = await this.catalog.findVariant(principal.tenantId, productId, variantId);
    if (!variant) throw new NotFoundException('Variant not found');
    return mapVariant(variant);
  }

  async updateVariant(principal: CatalogPrincipal, productId: string, variantId: string, input: UpdateVariantDto) {
    await this.withConstraintHandling(() => this.dataSource.transaction(async (manager) => {
      const product = await manager.getRepository(Product).findOne({ where: { tenantId: principal.tenantId, id: productId } });
      if (!product || product.status === 'archived') throw new NotFoundException('Active product not found');
      const repository = manager.getRepository(ProductVariant);
      const variant = await repository.findOne({ where: { tenantId: principal.tenantId, productId, id: variantId } });
      if (!variant) throw new NotFoundException('Variant not found');
      const oldSku = variant.sku;
      if (input.sku !== undefined) variant.sku = this.normalizeSku(input.sku);
      if (input.attributes !== undefined) variant.attributes = input.attributes;
      if (input.price !== undefined) variant.price = input.price == null ? null : String(input.price);
      if (input.cost !== undefined) variant.cost = input.cost == null ? null : String(input.cost);
      if (input.status !== undefined) variant.status = input.status;
      variant.updatedBy = principal.subject;
      await repository.save(variant);
      if (input.sku !== undefined && variant.sku !== oldSku) {
        await manager.query(
          'UPDATE catalog_skus SET normalized_sku = $3 WHERE tenant_id = $1 AND variant_id = $2',
          [principal.tenantId, variant.id, variant.sku.toLowerCase()],
        );
      }
      if (input.barcode !== undefined) {
        const identifiers = manager.getRepository(ProductIdentifier);
        await identifiers.delete({ tenantId: principal.tenantId, variantId: variant.id });
        if (input.barcode?.trim()) await this.insertVariantBarcode(manager, principal.tenantId, variant.id, input.barcode);
      }
      await appendCatalogAudit(manager, principal, 'catalog.variant.updated', 'product_variant', variant.id, { fields: Object.keys(input) });
    }));
    const variant = await this.catalog.findVariant(principal.tenantId, productId, variantId);
    if (!variant) throw new NotFoundException('Variant not found');
    return mapVariant(variant);
  }

  async createProductInTransaction(
    manager: EntityManager,
    principal: CatalogPrincipal,
    input: CreateProductDto,
  ): Promise<Product> {
    await this.assertActiveCategory(manager, principal.tenantId, input.categoryId);
    const repository = manager.getRepository(Product);
    const product = repository.create(this.productFields(input, principal.subject));
    product.tenantId = principal.tenantId;
    product.sku = this.normalizeSku(input.sku);
    product.name = input.name.trim();
    product.createdBy = principal.subject;
    product.updatedBy = principal.subject;
    const saved = await repository.save(product);
    await this.insertSku(manager, principal.tenantId, saved.id, null, saved.sku);
    await this.replaceProductIdentifiers(manager, principal.tenantId, saved.id, input);
    return saved;
  }

  async auditImport(manager: EntityManager, principal: CatalogPrincipal, count: number) {
    await appendCatalogAudit(manager, principal, 'catalog.products.imported', 'product', null, { count });
  }

  private productFields(input: CreateProductDto | UpdateProductDto, actor: string): Partial<Product> {
    const fields: Partial<Product> = { updatedBy: actor };
    if (input.description !== undefined) fields.description = input.description?.trim() || null;
    if (input.categoryId !== undefined) fields.categoryId = input.categoryId ?? null;
    if (input.brand !== undefined) fields.brand = input.brand?.trim() || null;
    if (input.productType !== undefined) fields.productType = input.productType;
    if (input.status !== undefined) fields.status = input.status;
    if (input.unitOfMeasure !== undefined) fields.unitOfMeasure = input.unitOfMeasure.trim();
    if (input.weight !== undefined) fields.weight = input.weight == null ? null : String(input.weight);
    if (input.dimensions !== undefined) fields.dimensions = input.dimensions ?? null;
    if (input.taxInformation !== undefined) fields.taxInformation = input.taxInformation ?? null;
    if (input.trackBatch !== undefined) fields.trackBatch = input.trackBatch;
    if (input.trackSerialNumber !== undefined) fields.trackSerialNumber = input.trackSerialNumber;
    if (input.trackExpiry !== undefined) fields.trackExpiry = input.trackExpiry;
    return fields;
  }

  private async replaceProductIdentifiers(
    manager: EntityManager,
    tenantId: string,
    productId: string,
    input: Partial<CreateProductDto>,
    merge = false,
  ) {
    const repository = manager.getRepository(ProductIdentifier);
    const current = merge ? await repository.find({ where: { tenantId, productId } }) : [];
    const values = new Map<ProductIdentifierType, string>();
    for (const identifier of current) values.set(identifier.kind as ProductIdentifierType, identifier.code);
    for (const [kind, field] of PRODUCT_IDENTIFIER_FIELDS) {
      const value = input[field];
      if (value === undefined) continue;
      if (value === null || !value.trim()) values.delete(kind);
      else values.set(kind, value.trim());
    }
    const normalized = [...values.values()].map((value) => value.toLowerCase());
    if (new Set(normalized).size !== normalized.length) throw new ConflictException('Product identifiers must be unique');

    await repository.delete({ tenantId, productId });
    if (values.size) {
      await repository.save([...values].map(([kind, code]) => repository.create({
        tenantId,
        productId,
        variantId: null,
        kind,
        code,
      })));
    }
  }

  private async insertVariantBarcode(manager: EntityManager, tenantId: string, variantId: string, barcode: string) {
    await manager.getRepository(ProductIdentifier).save({
      tenantId,
      productId: null,
      variantId,
      kind: 'variant_barcode',
      code: barcode.trim(),
    });
  }

  private async insertSku(manager: EntityManager, tenantId: string, productId: string | null, variantId: string | null, sku: string) {
    await manager.query(
      'INSERT INTO catalog_skus (tenant_id, product_id, variant_id, normalized_sku) VALUES ($1, $2, $3, $4)',
      [tenantId, productId, variantId, sku.toLowerCase()],
    );
  }

  private async assertActiveCategory(manager: EntityManager, tenantId: string, categoryId?: string | null) {
    if (!categoryId) return;
    const category = await manager.getRepository(Category).findOne({ where: { tenantId, id: categoryId, status: 'active' } });
    if (!category) throw new BadRequestException('categoryId must reference an active category in this tenant');
  }

  private normalizeSku(sku: string) {
    const normalized = sku.trim().toUpperCase();
    if (!normalized) throw new BadRequestException('SKU cannot be blank');
    return normalized;
  }

  private async withConstraintHandling<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const databaseError = error as { code?: string; driverError?: { code?: string; constraint?: string } };
      const code = databaseError.driverError?.code ?? databaseError.code;
      const constraint = databaseError.driverError?.constraint ?? '';
      if (code === '23505') {
        if (constraint.includes('sku')) throw new ConflictException('SKU already exists in this tenant');
        if (constraint.includes('identifier')) throw new ConflictException('Barcode or product identifier already exists in this tenant');
        throw new ConflictException('Catalog record already exists');
      }
      if (code === '23503') throw new BadRequestException('A referenced catalog record is invalid');
      throw error;
    }
  }
}
