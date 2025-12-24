import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'post_modules'

  async up() {
    // Safety: ensure clean slate (helps when rerunning fresh after partial failures)
    await this.schema.raw(
      'DROP TRIGGER IF EXISTS trg_post_modules_no_post_scope_reuse ON post_modules'
    )
    await this.schema.raw('DROP FUNCTION IF EXISTS prevent_post_scope_module_reuse')
    await this.schema.dropTableIfExists(this.tableName)

    await this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)

      table.uuid('post_id').notNullable().references('id').inTable('posts').onDelete('CASCADE')

      table
        .uuid('module_id')
        .notNullable()
        .references('id')
        .inTable('module_instances')
        .onDelete('CASCADE')

      table.integer('order_index').notNullable().defaultTo(0)
      // Review workflow fields
      table.boolean('review_deleted').notNullable().defaultTo(false)
      table.integer('review_order_index').nullable()
      table.boolean('review_added').notNullable().defaultTo(false)
      // Overrides
      table.jsonb('review_overrides').nullable()
      // AI Review workflow fields
      table.jsonb('ai_review_overrides').nullable()
      table.boolean('ai_review_added').defaultTo(false)
      table.boolean('ai_review_deleted').defaultTo(false)

      // Shallow overrides for global/static modules on a per-post basis
      table.jsonb('overrides').nullable()
      // Lock control (template-enforced)
      table.boolean('locked').notNullable().defaultTo(false)

      table.text('admin_label').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      // Ensure a module is only attached to a post once
      table.unique(['post_id', 'module_id'])

      // CRITICAL: Composite index for efficient ordered retrieval when rendering pages
      table.index(['post_id', 'order_index'])
      table.index('module_id') // For reverse lookups
    })

    // GIN index for JSONB overrides
    await this.schema.raw(
      'CREATE INDEX post_modules_overrides_gin ON post_modules USING GIN (overrides)'
    )

    // Guard: prevent post-scoped module instances from being attached to multiple posts.
    // Global/static instances remain shareable.
    await this.schema.raw(`
      CREATE OR REPLACE FUNCTION prevent_post_scope_module_reuse()
      RETURNS trigger AS $$
      BEGIN
        IF EXISTS (SELECT 1 FROM module_instances mi WHERE mi.id = NEW.module_id AND mi.scope = 'post') THEN
          IF EXISTS (
            SELECT 1 FROM post_modules pm
            WHERE pm.module_id = NEW.module_id
              AND (TG_OP = 'INSERT' OR pm.id <> NEW.id)
          ) THEN
            RAISE EXCEPTION 'post-scoped module instances cannot be attached to multiple posts (module_id=%)', NEW.module_id;
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_post_modules_no_post_scope_reuse ON post_modules;
      CREATE TRIGGER trg_post_modules_no_post_scope_reuse
      BEFORE INSERT OR UPDATE ON post_modules
      FOR EACH ROW EXECUTE FUNCTION prevent_post_scope_module_reuse();
    `)
  }

  async down() {
    await this.schema.raw(
      'DROP TRIGGER IF EXISTS trg_post_modules_no_post_scope_reuse ON post_modules'
    )
    await this.schema.raw('DROP FUNCTION IF EXISTS prevent_post_scope_module_reuse')
    await this.schema.dropTable(this.tableName)
  }
}
