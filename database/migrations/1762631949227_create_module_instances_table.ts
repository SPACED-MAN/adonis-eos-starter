import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'module_instances'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      // Scope: only 'post' or 'global' are supported for fresh installs
      table.string('scope', 20).notNullable().defaultTo('post')
      // Optional human label for global modules
      table.text('global_label').nullable()

      table.string('type', 100).notNullable()

      // For post-scoped modules
      table.uuid('post_id').nullable().references('id').inTable('posts').onDelete('CASCADE')

      // For global modules (unique when scope=global)
      table.string('global_slug', 255).nullable()

      // Module configuration and data (includes locale-specific content)
      table.jsonb('props').notNullable().defaultTo('{}')
      // Review props for review workflow
      table.jsonb('review_props').nullable()
      table.jsonb('ai_review_props').nullable()

      // Render caching
      table.text('render_cache_html').nullable()
      table.string('render_etag', 100).nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      // Uniqueness and performance
      table.unique(['scope', 'global_slug'], 'module_instances_scope_global_slug_unique')
      table.index(['scope', 'type'], 'module_instances_scope_idx') // For module filtering
      table.index('post_id') // For post-module lookups
      table.index('global_slug', 'idx_module_instances_global')
    })

    // GIN index for JSONB queries (must be done after table creation)
    this.schema.raw('CREATE INDEX module_instances_props_gin ON module_instances USING GIN (props)')
    // Enforce allowed scope values at DB level
    this.schema.raw(
      `ALTER TABLE "module_instances" ADD CONSTRAINT "module_instances_scope_chk" CHECK (scope IN ('post','global'))`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
