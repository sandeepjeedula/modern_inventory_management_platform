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
import { ProductIdentifier } from './product-identifier.entity';
import { Product } from './product.entity';

@Entity('product_variants')
@Index('variants_tenant_product_idx', ['tenantId', 'productId'])
export class ProductVariant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, (product) => product.variants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ type: 'varchar', length: 100 })
  sku: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  attributes: Record<string, string | number | boolean>;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  price: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  cost: string | null;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: 'active' | 'archived';

  @Column({ name: 'created_by', type: 'varchar', length: 200 })
  createdBy: string;

  @Column({ name: 'updated_by', type: 'varchar', length: 200 })
  updatedBy: string;

  @OneToMany(() => ProductIdentifier, (identifier) => identifier.variant)
  identifiers: ProductIdentifier[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
