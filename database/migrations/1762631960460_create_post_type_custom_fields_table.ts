import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'post_type_custom_fields'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)

      table.string('post_type', 50).notNullable()

      table
        .uuid('field_id')
        .notNullable()
        .references('id')
        .inTable('custom_fields')
        .onDelete('CASCADE')

      // Ensure a custom field is only attached to a post type once
      table.unique(['post_type', 'field_id'])

      // Performance: Composite index for efficient lookups when loading post type schemas
      table.index(['post_type', 'field_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
