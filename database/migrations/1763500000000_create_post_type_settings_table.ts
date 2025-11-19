import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
	protected tableName = 'post_type_settings'

	async up() {
		// Drop leftover view/materialized view with same name to avoid relation conflicts
		await this.schema.raw(`
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'v' AND n.nspname = current_schema() AND c.relname = '${this.tableName}'
  ) THEN
    EXECUTE 'DROP VIEW "' || '${this.tableName}' || '" CASCADE';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'm' AND n.nspname = current_schema() AND c.relname = '${this.tableName}'
  ) THEN
    EXECUTE 'DROP MATERIALIZED VIEW "' || '${this.tableName}' || '" CASCADE';
  END IF;
END
$$;
    `)

		// Create table safely (no-op if it already exists)
		await this.schema.raw(`
CREATE TABLE IF NOT EXISTS "${this.tableName}" (
  "id" serial PRIMARY KEY,
  "post_type" varchar(50) NOT NULL UNIQUE,
  "auto_redirect_on_slug_change" boolean NOT NULL DEFAULT TRUE,
  "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
    `)
	}

	async down() {
		await this.schema.dropTableIfExists(this.tableName)
	}
}
