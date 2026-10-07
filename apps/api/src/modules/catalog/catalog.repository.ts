import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { ProductListQueryDto } from './dto/catalog-query.dto';
import { Category } from './entities/category.entity';
import { Product } from './entities/product.entity';
import { ProductVariant } from './entities/product-variant.entity';

@Injectable()
export class CatalogRepository {
  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    @InjectRepository(ProductVariant) private readonly variants: Repository<ProductVariant>,
  ) {}

  async listProducts(tenantId: string, query: ProductListQueryDto): Promise<[Product[], number]> {
    const builder = this.products.createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.identifiers', 'identifier')
      .loadRelationCountAndMap('product.variantCount', 'product.variants')
      .where('product.tenant_id = :tenantId', { tenantId });

    if (query.status) builder.andWhere('product.status = :status', { status: query.status });
    else builder.andWhere('product.status <> :archived', { archived: 'archived' });
    if (query.productType) builder.andWhere('product.product_type = :productType', { productType: query.productType });
    if (query.categoryId) builder.andWhere('product.category_id = :categoryId', { categoryId: query.categoryId });
    if (query.brand) builder.andWhere('product.brand ILIKE :brand', { brand: query.brand });
    if (query.search?.trim()) {
      builder.andWhere(
        `(product.sku ILIKE :search OR product.name ILIKE :search OR product.brand ILIKE :search OR EXISTS (
          SELECT 1 FROM product_identifiers search_identifier
          WHERE search_identifier.tenant_id = product.tenant_id
            AND search_identifier.product_id = product.id
            AND search_identifier.code ILIKE :search
        ) OR EXISTS (
          SELECT 1 FROM product_variants search_variant
          WHERE search_variant.tenant_id = product.tenant_id
            AND search_variant.product_id = product.id
            AND search_variant.sku ILIKE :search
        ) OR EXISTS (
          SELECT 1 FROM product_identifiers variant_identifier
          JOIN product_variants identified_variant
            ON identified_variant.tenant_id = variant_identifier.tenant_id
            AND identified_variant.id = variant_identifier.variant_id
          WHERE variant_identifier.tenant_id = product.tenant_id
            AND identified_variant.product_id = product.id
            AND variant_identifier.code ILIKE :search
        ))`,
        { search: `%${query.search.trim()}%` },
      );
    }

    const sortColumns = {
      sku: 'product.sku',
      name: 'product.name',
      createdAt: 'product.createdAt',
      updatedAt: 'product.updatedAt',
    } as const;
    builder.orderBy(sortColumns[query.sortBy], query.sortOrder)
      .addOrderBy('product.id', 'ASC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize);

    return builder.getManyAndCount();
  }

  findProduct(tenantId: string, productId: string): Promise<Product | null> {
    return this.products.findOne({
      where: { tenantId, id: productId },
      relations: { category: true, identifiers: true, variants: { identifiers: true }, images: true },
      order: { images: { sortOrder: 'ASC', createdAt: 'ASC' } },
    });
  }

  findCategory(tenantId: string, categoryId: string): Promise<Category | null> {
    return this.categories.findOne({ where: { tenantId, id: categoryId } });
  }

  listCategories(tenantId: string): Promise<Category[]> {
    return this.categories.find({ where: { tenantId }, order: { name: 'ASC' } });
  }

  findVariant(tenantId: string, productId: string, variantId: string): Promise<ProductVariant | null> {
    return this.variants.findOne({
      where: { tenantId, productId, id: variantId },
      relations: { identifiers: true },
    });
  }

  productQuery(tenantId: string): SelectQueryBuilder<Product> {
    return this.products.createQueryBuilder('product').where('product.tenant_id = :tenantId', { tenantId });
  }
}
