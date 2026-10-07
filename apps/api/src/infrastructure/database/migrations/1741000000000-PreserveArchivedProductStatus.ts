import { MigrationInterface, QueryRunner } from 'typeorm';

export class PreserveArchivedProductStatus1741000000000 implements MigrationInterface {
  name = 'PreserveArchivedProductStatus1741000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE products ADD COLUMN archived_from_status varchar(20)`);
    await queryRunner.query(`
      ALTER TABLE products ADD CONSTRAINT products_archived_from_status_valid
      CHECK (archived_from_status IS NULL OR archived_from_status IN ('active', 'draft'))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE products DROP CONSTRAINT IF EXISTS products_archived_from_status_valid');
    await queryRunner.query('ALTER TABLE products DROP COLUMN IF EXISTS archived_from_status');
  }
}