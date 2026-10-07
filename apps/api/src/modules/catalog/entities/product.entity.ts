import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from './category.entity';
import { ProductIdentifier } from './product-identifier.entity';
import { ProductImage } from './product-image.entity';
import { ProductVariant } from './product-variant.entity';

export type ProductDimensions = { length?: number; width?: number; height?: number; unit?: string };
export type ProductTaxInformation = { code?: string; rate?: number; inclusive?: boolean };

@Entity('products')
@Index('products_tenant_created_idx', ['tenantId', 'createdAt'])
@Index('products_tenant_status_idx', ['tenantId', 'status'])
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 100 })
  sku: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId: string | null;

  @ManyToOne(() => Category, { nullable: true })
  @JoinColumn({ name: 'category_id' })
  category: Category | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  brand: string | null;

  @Column({ name: 'product_type', type: 'varchar', length: 30, default: 'physical' })
  productType: 'physical' | 'digital' | 'service' | 'bundle';

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status: 'active' | 'draft' | 'archived';

  @Column({ name: 'unit_of_measure', type: 'varchar', length: 30, default: 'each' })
  unitOfMeasure: string;

  @Column({ type: 'numeric', precision: 12, scale: 4, nullable: true })
  weight: string | null;

  @Column({ type: 'jsonb', nullable: true })
  dimensions: ProductDimensions | null;

  @Column({ name: 'tax_information', type: 'jsonb', nullable: true })
  taxInformation: ProductTaxInformation | null;

  @Column({ name: 'track_batch', type: 'boolean', default: false })
  trackBatch: boolean;

  @Column({ name: 'track_serial_number', type: 'boolean', default: false })
  trackSerialNumber: boolean;

  @Column({ name: 'track_expiry', type: 'boolean', default: false })
  trackExpiry: boolean;

  @Column({ name: 'created_by', type: 'varchar', length: 200 })
  createdBy: string;

  @Column({ name: 'updated_by', type: 'varchar', length: 200 })
  updatedBy: string;

  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt: Date | null;

  @Column({ name: 'archived_from_status', type: 'varchar', length: 20, nullable: true })
  archivedFromStatus: 'active' | 'draft' | null;

  @OneToMany(() => ProductIdentifier, (identifier) => identifier.product)
  identifiers: ProductIdentifier[];

  @OneToMany(() => ProductVariant, (variant) => variant.product)
  variants: ProductVariant[];

  variantCount?: number;

  @OneToMany(() => ProductImage, (image) => image.product)
  images: ProductImage[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
