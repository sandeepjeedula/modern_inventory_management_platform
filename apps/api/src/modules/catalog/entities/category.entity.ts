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

@Entity('categories')
@Index('categories_tenant_status_idx', ['tenantId', 'status'])
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  description: string | null;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId: string | null;

  @ManyToOne(() => Category, (category) => category.children, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: Category | null;

  @OneToMany(() => Category, (category) => category.parent)
  children: Category[];

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: 'active' | 'inactive';

  @Column({ name: 'created_by', type: 'varchar', length: 200 })
  createdBy: string;

  @Column({ name: 'updated_by', type: 'varchar', length: 200 })
  updatedBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
