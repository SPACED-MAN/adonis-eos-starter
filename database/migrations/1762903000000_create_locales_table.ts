import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'locales'

  async up() {
    // Drop any conflicting non-table relation named "locales" (search_path-aware)
    await this.schema.raw(`
DO $$
DECLARE rel record;
BEGIN
  FOR rel IN
    SELECT c.relkind, n.nspname AS schema_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = '${this.tableName}'
      AND n.nspname = ANY(current_schemas(true))
  LOOP
    IF rel.relkind = 'v' THEN
      EXECUTE 'DROP VIEW IF EXISTS "' || rel.schema_name || '"."${this.tableName}" CASCADE';
    ELSIF rel.relkind = 'm' THEN
      EXECUTE 'DROP MATERIALIZED VIEW IF EXISTS "' || rel.schema_name || '"."${this.tableName}" CASCADE';
    ELSIF rel.relkind = 'S' THEN
      EXECUTE 'DROP SEQUENCE IF EXISTS "' || rel.schema_name || '"."${this.tableName}" CASCADE';
    ELSIF rel.relkind = 'i' THEN
      EXECUTE 'DROP INDEX IF EXISTS "' || rel.schema_name || '"."${this.tableName}" CASCADE';
    ELSIF rel.relkind = 'f' THEN
      EXECUTE 'DROP FOREIGN TABLE IF EXISTS "' || rel.schema_name || '"."${this.tableName}" CASCADE';
    END IF;
  END LOOP;
END
$$;
    `)

    // Ensure any leftover table named "locales" is dropped using the schema API
    await this.schema.dropTableIfExists(this.tableName)

    const exists = await this.schema.hasTable(this.tableName)
    if (!exists) {
      await this.schema.createTable(this.tableName, (table) => {
        table.string('code', 10).primary()
        table.boolean('is_enabled').notNullable().defaultTo(true)
        table.boolean('is_default').notNullable().defaultTo(false)
        table.timestamp('created_at').notNullable().defaultTo(this.now())
        table.timestamp('updated_at').notNullable().defaultTo(this.now())
      })
    }
    // Enforce a single default via a partial unique index (PostgreSQL)
    await this.schema.raw(
      `CREATE UNIQUE INDEX IF NOT EXISTS ${this.tableName}_default_unique ON ${this.tableName} ((1)) WHERE is_default = true;`
    )
  }

  async down() {
    await this.schema.raw(`DROP INDEX IF EXISTS ${this.tableName}_default_unique;`)
    await this.schema.dropTableIfExists(this.tableName)
  }
}
