import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'module_group_modules'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)

      table
        .uuid('module_group_id')
        .notNullable()
        .references('id')
        .inTable('module_groups')
        .onDelete('CASCADE')

      table.string('type', 100).notNullable()
      table.jsonb('default_props').notNullable().defaultTo('{}')
      table.integer('order_index').notNullable().defaultTo(0)
      // Scope for module instance when seeding posts: 'post' or 'global'
      table.string('scope', 20).notNullable().defaultTo('post')
      // For scope=global, the global module slug to reference
      table.string('global_slug', 255).nullable()

      // If true, this module cannot be removed from posts using this module group
      table.boolean('locked').notNullable().defaultTo(false)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      // Performance: Composite index for ordered retrieval
      table.index(['module_group_id', 'order_index'])
      table.index(['module_group_id', 'order_index', 'scope'], 'module_group_modules_scope_idx')
    })

    // GIN index for JSONB default_props
    this.schema.raw(
      'CREATE INDEX module_group_modules_default_props_gin ON module_group_modules USING GIN (default_props)'
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
