import { Product } from './entities/product.entity';
import { ProductVariant } from './entities/product-variant.entity';

export function mapVariant(variant: ProductVariant) {
  return {
    id: variant.id,
    productId: variant.productId,
    sku: variant.sku,
    attributes: variant.attributes,
    barcode: variant.identifiers?.find((identifier) => identifier.kind === 'variant_barcode')?.code ?? null,
    price: variant.price,
    cost: variant.cost,
    status: variant.status,
    createdAt: variant.createdAt,
    updatedAt: variant.updatedAt,
  };
}

export function mapProduct(product: Product) {
  const codes = new Map(product.identifiers?.map((identifier) => [identifier.kind, identifier.code]) ?? []);
  return {
    id: product.id,
    tenantId: product.tenantId,
    sku: product.sku,
    name: product.name,
    description: product.description,
    categoryId: product.categoryId,
    category: product.category ? { id: product.category.id, name: product.category.name, status: product.category.status } : null,
    brand: product.brand,
    productType: product.productType,
    status: product.status,
    barcode: codes.get('barcode') ?? null,
    upc: codes.get('upc') ?? null,
    ean: codes.get('ean') ?? null,
    gtin: codes.get('gtin') ?? null,
    unitOfMeasure: product.unitOfMeasure,
    weight: product.weight,
    dimensions: product.dimensions,
    taxInformation: product.taxInformation,
    trackBatch: product.trackBatch,
    trackSerialNumber: product.trackSerialNumber,
    trackExpiry: product.trackExpiry,
    variants: product.variants?.map(mapVariant) ?? [],
    variantCount: product.variantCount ?? product.variants?.length ?? 0,
    images: product.images?.map((image) => ({
      id: image.id,
      originalName: image.originalName,
      contentType: image.contentType,
      byteSize: image.byteSize,
      altText: image.altText,
      sortOrder: image.sortOrder,
      isPrimary: image.isPrimary,
      createdAt: image.createdAt,
    })) ?? [],
    createdBy: product.createdBy,
    updatedBy: product.updatedBy,
    archivedAt: product.archivedAt,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}
