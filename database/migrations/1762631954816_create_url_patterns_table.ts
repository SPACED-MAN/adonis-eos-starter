import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'url_patterns'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)

      table.string('post_type', 50).notNullable()
      table.string('locale', 10).notNullable().defaultTo('en')

      // Pattern like "/blog/{yyyy}/{slug}" or "/es/blog/{yyyy}/{slug}"
      table.string('pattern', 500).notNullable()

      // One pattern per post type+locale should be the default
      table.boolean('is_default').notNullable().defaultTo(false)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      // Ensure only one default pattern per post type and locale
      table.unique(['post_type', 'locale', 'is_default'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
