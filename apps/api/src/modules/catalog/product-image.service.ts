import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CatalogPrincipal } from '../../auth/catalog-principal';
import { OBJECT_STORAGE, ObjectStorage } from '../../infrastructure/object-storage/object-storage.port';
import { appendCatalogAudit } from './catalog-audit';
import { UpdateProductImageDto } from './dto/product-image.dto';
import { ProductImage } from './entities/product-image.entity';
import { Product } from './entities/product.entity';
import { ReorderProductImagesDto } from './dto/product-image.dto';

const IMAGE_TYPES: Record<string, { extension: string; signature: (buffer: Buffer) => boolean }> = {
  'image/jpeg': { extension: 'jpg', signature: (buffer) => buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff },
  'image/png': { extension: 'png', signature: (buffer) => buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/gif': { extension: 'gif', signature: (buffer) => ['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6)) },
  'image/webp': { extension: 'webp', signature: (buffer) => buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP' },
};

@Injectable()
export class ProductImageService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async upload(principal: CatalogPrincipal, productId: string, file: Express.Multer.File, altText?: string) {
    if (!file || file.size < 1 || file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('Image must be between 1 byte and 10 MB');
    }
    const type = IMAGE_TYPES[file.mimetype];
    if (!type || !type.signature(file.buffer)) throw new BadRequestException('Use a valid JPEG, PNG, GIF, or WebP image');
    const product = await this.dataSource.getRepository(Product).findOne({
      where: { id: productId, tenantId: principal.tenantId },
    });
    if (!product || product.status === 'archived') throw new NotFoundException('Active product not found');

    const storageKey = `${principal.tenantId}/${productId}/${randomUUID()}.${type.extension}`;
    await this.storage.put(storageKey, file.buffer, file.mimetype);
    let image: ProductImage;
    try {
      image = await this.dataSource.transaction(async (manager) => {
        await this.lockImageSet(manager, principal, productId);
        const repository = manager.getRepository(ProductImage);
        const result = await repository.createQueryBuilder('image')
          .select('COALESCE(MAX(image.sort_order), -1)', 'max')
          .where('image.tenant_id = :tenantId AND image.product_id = :productId', { tenantId: principal.tenantId, productId })
          .getRawOne<{ max: string }>();
        const sortOrder = Number(result?.max ?? -1) + 1;
        const isPrimary = sortOrder === 0;
        const created = await repository.save(repository.create({
          tenantId: principal.tenantId,
          productId,
          storageKey,
          originalName: file.originalname.replace(/[\\/]/g, '_').slice(0, 255),
          contentType: file.mimetype,
          byteSize: file.size,
          altText: altText?.trim().slice(0, 300) || null,
          sortOrder,
          isPrimary,
        }));
        await appendCatalogAudit(manager, principal, 'catalog.product_image.uploaded', 'product_image', created.id, { productId });
        return created;
      });
    } catch (error) {
      await this.storage.delete(storageKey).catch(() => undefined);
      throw error;
    }
    return this.mapImage(image);
  }

  async update(principal: CatalogPrincipal, productId: string, imageId: string, input: UpdateProductImageDto) {
    const image = await this.dataSource.transaction(async (manager) => {
      await this.lockImageSet(manager, principal, productId);
      const repository = manager.getRepository(ProductImage);
      const existing = await repository.findOne({ where: { tenantId: principal.tenantId, productId, id: imageId } });
      if (!existing) throw new NotFoundException('Product image not found');
      if (input.isPrimary) {
        await repository.createQueryBuilder().update(ProductImage).set({ isPrimary: false })
          .where('tenant_id = :tenantId AND product_id = :productId', { tenantId: principal.tenantId, productId })
          .execute();
      }
      if (input.altText !== undefined) existing.altText = input.altText?.trim().slice(0, 300) || null;
      if (input.sortOrder !== undefined) existing.sortOrder = input.sortOrder;
      if (input.isPrimary !== undefined) existing.isPrimary = input.isPrimary;
      const saved = await repository.save(existing);
      await appendCatalogAudit(manager, principal, 'catalog.product_image.updated', 'product_image', imageId, { productId });
      return saved;
    });
    return this.mapImage(image);
  }

  async remove(principal: CatalogPrincipal, productId: string, imageId: string) {
    const storageKey = await this.dataSource.transaction(async (manager) => {
      await this.lockImageSet(manager, principal, productId);
      const repository = manager.getRepository(ProductImage);
      const image = await repository.findOne({ where: { tenantId: principal.tenantId, productId, id: imageId } });
      if (!image) throw new NotFoundException('Product image not found');
      await repository.delete({ id: image.id, tenantId: principal.tenantId, productId });
      if (image.isPrimary) {
        const next = await repository.findOne({
          where: { tenantId: principal.tenantId, productId },
          order: { sortOrder: 'ASC', createdAt: 'ASC' },
        });
        if (next) {
          next.isPrimary = true;
          await repository.save(next);
        }
      }
      await appendCatalogAudit(manager, principal, 'catalog.product_image.removed', 'product_image', image.id, { productId });
      return image.storageKey;
    });
    await this.storage.delete(storageKey);
    return { removed: true };
  }

  async reorder(principal: CatalogPrincipal, productId: string, input: ReorderProductImagesDto) {
    await this.dataSource.transaction(async (manager) => {
      await this.lockImageSet(manager, principal, productId);
      const repository = manager.getRepository(ProductImage);
      const existing = await repository.find({ where: { tenantId: principal.tenantId, productId } });
      const requested = new Set(input.imageIds);
      if (requested.size !== existing.length || existing.some((image) => !requested.has(image.id))) {
        throw new BadRequestException('imageIds must contain every image for this product exactly once');
      }
      const offset = existing.length + 1;
      await repository.createQueryBuilder().update(ProductImage)
        .set({ sortOrder: () => `sort_order + ${offset}` })
        .where('tenant_id = :tenantId AND product_id = :productId', { tenantId: principal.tenantId, productId })
        .execute();
      for (const [sortOrder, imageId] of input.imageIds.entries()) {
        await repository.update({ tenantId: principal.tenantId, productId, id: imageId }, { sortOrder });
      }
      await appendCatalogAudit(manager, principal, 'catalog.product_images.reordered', 'product', productId, { imageCount: existing.length });
    });
    return this.list(principal.tenantId, productId);
  }

  async readUrl(tenantId: string, productId: string, imageId: string) {
    const image = await this.dataSource.getRepository(ProductImage).findOne({
      where: { tenantId, productId, id: imageId },
    });
    if (!image) throw new NotFoundException('Product image not found');
    return { url: await this.storage.readUrl(image.storageKey), expiresInSeconds: 300 };
  }

  async list(tenantId: string, productId: string) {
    const product = await this.dataSource.getRepository(Product).findOne({ where: { tenantId, id: productId } });
    if (!product) throw new NotFoundException('Product not found');
    const images = await this.dataSource.getRepository(ProductImage).find({
      where: { tenantId, productId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    return { data: await Promise.all(images.map((image) => this.mapImage(image))) };
  }

  private async mapImage(image: ProductImage) {
    return {
      id: image.id,
      productId: image.productId,
      originalName: image.originalName,
      contentType: image.contentType,
      byteSize: image.byteSize,
      altText: image.altText,
      sortOrder: image.sortOrder,
      isPrimary: image.isPrimary,
      url: await this.storage.readUrl(image.storageKey),
      createdAt: image.createdAt,
    };
  }

  private async lockImageSet(manager: import('typeorm').EntityManager, principal: CatalogPrincipal, productId: string) {
    await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`catalog-images:${principal.tenantId}:${productId}`]);
  }
}
