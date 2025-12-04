import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'module_scopes'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)

      // Restrict which module types can be used with which post types
      table.string('module_type', 100).notNullable()
      table.string('post_type', 50).notNullable()

      // Ensure a module type can only be restricted once per post type
      table.unique(['module_type', 'post_type'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
