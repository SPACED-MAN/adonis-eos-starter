import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'post_modules'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      
      table.uuid('post_id').notNullable()
        .references('id')
        .inTable('posts')
        .onDelete('CASCADE')
      
      table.uuid('module_id').notNullable()
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
      
      // Shallow overrides for global/static modules on a per-post basis
      table.jsonb('overrides').nullable()
      // Lock control (template-enforced)
      table.boolean('locked').notNullable().defaultTo(false)
      
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
      
      // Ensure a module is only attached to a post once
      table.unique(['post_id', 'module_id'])
      
      // CRITICAL: Composite index for efficient ordered retrieval when rendering pages
      table.index(['post_id', 'order_index'])
      table.index('module_id') // For reverse lookups
    })
    
    // GIN index for JSONB overrides
    this.schema.raw('CREATE INDEX post_modules_overrides_gin ON post_modules USING GIN (overrides)')
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}