import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Product } from './product.entity';
import { ProductVariant } from './product-variant.entity';

export type ProductIdentifierType = 'barcode' | 'upc' | 'ean' | 'gtin';

@Entity('product_identifiers')
export class ProductIdentifier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'product_id', type: 'uuid', nullable: true })
  productId: string | null;

  @ManyToOne(() => Product, (product) => product.identifiers, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product | null;

  @Column({ name: 'variant_id', type: 'uuid', nullable: true })
  variantId: string | null;

  @ManyToOne(() => ProductVariant, (variant) => variant.identifiers, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant | null;

  @Column({ type: 'varchar', length: 20 })
  kind: ProductIdentifierType | 'variant_barcode';

  @Column({ type: 'varchar', length: 100 })
  code: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
