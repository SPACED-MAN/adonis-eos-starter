import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'module_groups'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)

      table.string('name', 255).notNullable().unique()
      table.string('post_type', 50).notNullable()
      table.text('description').nullable()

      // If true, posts using this module group cannot add/remove modules
      table.boolean('locked').notNullable().defaultTo(false)
      table.boolean('is_default').notNullable().defaultTo(false)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      // Performance index for module group filtering by post type
      table.index('post_type')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
