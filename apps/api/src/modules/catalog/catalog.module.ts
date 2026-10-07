import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';
import { ObjectStorageModule } from '../../infrastructure/object-storage/object-storage.module';
import { CatalogBulkController } from './catalog-bulk.controller';
import { CatalogBulkService } from './catalog-bulk.service';
import { CatalogController } from './catalog.controller';
import { CatalogRepository } from './catalog.repository';
import { CatalogService } from './catalog.service';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { Category } from './entities/category.entity';
import { ProductIdentifier } from './entities/product-identifier.entity';
import { ProductImage } from './entities/product-image.entity';
import { ProductVariant } from './entities/product-variant.entity';
import { Product } from './entities/product.entity';
import { ProductImageController } from './product-image.controller';
import { ProductImageService } from './product-image.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Category, Product, ProductVariant, ProductIdentifier, ProductImage]),
    AuthModule,
    ObjectStorageModule,
  ],
  controllers: [CatalogBulkController, CatalogController, CategoryController, ProductImageController],
  providers: [CatalogRepository, CatalogService, CatalogBulkService, CategoryService, ProductImageService],
  exports: [CatalogService],
})
export class CatalogModule {}
