import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePlatformFoundation1710000000000 implements MigrationInterface {
  name = 'CreatePlatformFoundation1710000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await queryRunner.query(`
      CREATE TABLE tenants (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(200) NOT NULL,
        slug varchar(100) NOT NULL UNIQUE,
        status varchar(30) NOT NULL DEFAULT 'active',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT tenants_status_valid CHECK (status IN ('active', 'suspended'))
      )
    `);
    await queryRunner.query(`
      CREATE TABLE audit_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid REFERENCES tenants(id),
        actor_id uuid,
        action varchar(150) NOT NULL,
        resource_type varchar(150) NOT NULL,
        resource_id uuid,
        occurred_at timestamptz NOT NULL DEFAULT now(),
        request_id varchar(100),
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb
      )
    `);
    await queryRunner.query('CREATE INDEX audit_events_tenant_occurred_idx ON audit_events (tenant_id, occurred_at DESC)');
    await queryRunner.query('CREATE INDEX audit_events_resource_idx ON audit_events (resource_type, resource_id)');
    await queryRunner.query(`
      CREATE FUNCTION prevent_audit_event_mutation() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'audit_events are append-only';
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE TRIGGER audit_events_immutable
      BEFORE UPDATE OR DELETE ON audit_events
      FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation()
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TRIGGER IF EXISTS audit_events_immutable ON audit_events');
    await queryRunner.query('DROP FUNCTION IF EXISTS prevent_audit_event_mutation()');
    await queryRunner.query('DROP TABLE IF EXISTS audit_events');
    await queryRunner.query('DROP TABLE IF EXISTS tenants');
  }
}
