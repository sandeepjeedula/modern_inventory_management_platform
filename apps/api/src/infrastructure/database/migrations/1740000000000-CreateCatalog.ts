import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCatalog1740000000000 implements MigrationInterface {
  name = 'CreateCatalog1740000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE categories (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
        name varchar(160) NOT NULL,
        description varchar(300),
        parent_id uuid,
        status varchar(20) NOT NULL DEFAULT 'active',
        created_by varchar(200) NOT NULL,
        updated_by varchar(200) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT categories_tenant_id_id_uq UNIQUE (tenant_id, id),
        CONSTRAINT categories_parent_not_self CHECK (parent_id IS NULL OR parent_id <> id),
        CONSTRAINT categories_status_valid CHECK (status IN ('active', 'inactive')),
        CONSTRAINT categories_parent_tenant_fk FOREIGN KEY (tenant_id, parent_id)
          REFERENCES categories(tenant_id, id) ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX categories_sibling_name_uq
      ON categories (tenant_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name))
    `);
    await queryRunner.query('CREATE INDEX categories_tenant_status_idx ON categories (tenant_id, status)');

    await queryRunner.query(`
      CREATE TABLE products (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
        sku varchar(100) NOT NULL,
        name varchar(200) NOT NULL,
        description text,
        category_id uuid,
        brand varchar(120),
        product_type varchar(30) NOT NULL DEFAULT 'physical',
        status varchar(20) NOT NULL DEFAULT 'draft',
        unit_of_measure varchar(30) NOT NULL DEFAULT 'each',
        weight numeric(12, 4),
        dimensions jsonb,
        tax_information jsonb,
        track_batch boolean NOT NULL DEFAULT false,
        track_serial_number boolean NOT NULL DEFAULT false,
        track_expiry boolean NOT NULL DEFAULT false,
        created_by varchar(200) NOT NULL,
        updated_by varchar(200) NOT NULL,
        archived_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT products_tenant_id_id_uq UNIQUE (tenant_id, id),
        CONSTRAINT products_category_tenant_fk FOREIGN KEY (tenant_id, category_id)
          REFERENCES categories(tenant_id, id) ON DELETE RESTRICT,
        CONSTRAINT products_type_valid CHECK (product_type IN ('physical', 'digital', 'service', 'bundle')),
        CONSTRAINT products_status_valid CHECK (status IN ('active', 'draft', 'archived')),
        CONSTRAINT products_weight_nonnegative CHECK (weight IS NULL OR weight >= 0)
      )
    `);
    await queryRunner.query('CREATE INDEX products_tenant_sku_idx ON products (tenant_id, lower(sku))');
    await queryRunner.query('CREATE INDEX products_tenant_status_idx ON products (tenant_id, status)');
    await queryRunner.query('CREATE INDEX products_tenant_created_idx ON products (tenant_id, created_at DESC)');
    await queryRunner.query('CREATE INDEX products_tenant_category_idx ON products (tenant_id, category_id)');

    await queryRunner.query(`
      CREATE TABLE product_variants (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL,
        product_id uuid NOT NULL,
        sku varchar(100) NOT NULL,
        attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
        price numeric(12, 2),
        cost numeric(12, 2),
        status varchar(20) NOT NULL DEFAULT 'active',
        created_by varchar(200) NOT NULL,
        updated_by varchar(200) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT variants_tenant_id_id_uq UNIQUE (tenant_id, id),
        CONSTRAINT variants_product_tenant_fk FOREIGN KEY (tenant_id, product_id)
          REFERENCES products(tenant_id, id) ON DELETE CASCADE,
        CONSTRAINT variants_status_valid CHECK (status IN ('active', 'archived')),
        CONSTRAINT variants_price_nonnegative CHECK (price IS NULL OR price >= 0),
        CONSTRAINT variants_cost_nonnegative CHECK (cost IS NULL OR cost >= 0)
      )
    `);
    await queryRunner.query('CREATE INDEX variants_tenant_product_idx ON product_variants (tenant_id, product_id)');

    await queryRunner.query(`
      CREATE TABLE catalog_skus (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
        product_id uuid,
        variant_id uuid,
        normalized_sku varchar(100) NOT NULL,
        CONSTRAINT catalog_skus_owner_valid CHECK (
          (product_id IS NOT NULL AND variant_id IS NULL) OR (product_id IS NULL AND variant_id IS NOT NULL)
        ),
        CONSTRAINT catalog_skus_tenant_sku_uq UNIQUE (tenant_id, normalized_sku),
        CONSTRAINT catalog_skus_product_tenant_fk FOREIGN KEY (tenant_id, product_id)
          REFERENCES products(tenant_id, id) ON DELETE CASCADE,
        CONSTRAINT catalog_skus_variant_tenant_fk FOREIGN KEY (tenant_id, variant_id)
          REFERENCES product_variants(tenant_id, id) ON DELETE CASCADE
      )
    `);
    await queryRunner.query('CREATE UNIQUE INDEX catalog_skus_product_uq ON catalog_skus (product_id) WHERE product_id IS NOT NULL');
    await queryRunner.query('CREATE UNIQUE INDEX catalog_skus_variant_uq ON catalog_skus (variant_id) WHERE variant_id IS NOT NULL');

    await queryRunner.query(`
      CREATE TABLE product_identifiers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
        product_id uuid,
        variant_id uuid,
        kind varchar(20) NOT NULL,
        code varchar(100) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT product_identifiers_owner_valid CHECK (
          (product_id IS NOT NULL AND variant_id IS NULL) OR (product_id IS NULL AND variant_id IS NOT NULL)
        ),
        CONSTRAINT product_identifiers_kind_valid CHECK (kind IN ('barcode', 'upc', 'ean', 'gtin', 'variant_barcode')),
        CONSTRAINT product_identifiers_product_tenant_fk FOREIGN KEY (tenant_id, product_id)
          REFERENCES products(tenant_id, id) ON DELETE CASCADE,
        CONSTRAINT product_identifiers_variant_tenant_fk FOREIGN KEY (tenant_id, variant_id)
          REFERENCES product_variants(tenant_id, id) ON DELETE CASCADE
      )
    `);
    await queryRunner.query('CREATE UNIQUE INDEX product_identifiers_tenant_code_uq ON product_identifiers (tenant_id, lower(code))');
    await queryRunner.query(`
      CREATE UNIQUE INDEX product_identifiers_product_kind_uq
      ON product_identifiers (product_id, kind) WHERE product_id IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX product_identifiers_variant_barcode_uq
      ON product_identifiers (variant_id) WHERE variant_id IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE product_images (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL,
        product_id uuid NOT NULL,
        storage_key varchar(500) NOT NULL UNIQUE,
        original_name varchar(255) NOT NULL,
        content_type varchar(100) NOT NULL,
        byte_size integer NOT NULL,
        alt_text varchar(300),
        sort_order integer NOT NULL DEFAULT 0,
        is_primary boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT product_images_product_tenant_fk FOREIGN KEY (tenant_id, product_id)
          REFERENCES products(tenant_id, id) ON DELETE CASCADE,
        CONSTRAINT product_images_size_valid CHECK (byte_size > 0),
        CONSTRAINT product_images_order_valid CHECK (sort_order >= 0)
      )
    `);
    await queryRunner.query('CREATE INDEX product_images_product_order_idx ON product_images (tenant_id, product_id, sort_order)');
    await queryRunner.query('CREATE UNIQUE INDEX product_images_primary_uq ON product_images (tenant_id, product_id) WHERE is_primary');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS product_images');
    await queryRunner.query('DROP TABLE IF EXISTS product_identifiers');
    await queryRunner.query('DROP TABLE IF EXISTS catalog_skus');
    await queryRunner.query('DROP TABLE IF EXISTS product_variants');
    await queryRunner.query('DROP TABLE IF EXISTS products');
    await queryRunner.query('DROP TABLE IF EXISTS categories');
  }
}
