import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'module_instances'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      
      table.enum('scope', ['post', 'global', 'static'])
        .notNullable()
      
      table.string('type', 100).notNullable()
      
      // For post-scoped modules
      table.uuid('post_id').nullable()
        .references('id')
        .inTable('posts')
        .onDelete('CASCADE')
      
      // For global modules (unique when scope=global)
      table.string('global_slug', 255).nullable()
      
      // Module configuration and data (includes locale-specific content)
      table.jsonb('props').notNullable().defaultTo('{}')
      
      // Render caching
      table.text('render_cache_html').nullable()
      table.string('render_etag', 100).nullable()
      
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
      
      // Enforce global_slug uniqueness when scope is global
      table.unique(['scope', 'global_slug'])
      
      // Performance indexes
      table.index(['scope', 'type']) // For module filtering
      table.index('post_id') // For post-module lookups
    })
    
    // GIN index for JSONB queries (must be done after table creation)
    this.schema.raw('CREATE INDEX module_instances_props_gin ON module_instances USING GIN (props)')
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}