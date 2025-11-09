import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'url_redirects'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)

      table.string('from_path', 500).notNullable().unique()
      table.string('to_path', 500).notNullable()
      table.integer('http_status').notNullable().defaultTo(301)

      // Optional locale for locale-specific redirects
      table.string('locale', 10).nullable()

      // Optional link to a post (for auto-redirects when slug changes)
      table.uuid('post_id').nullable().references('id').inTable('posts').onDelete('CASCADE')

      // Time-based activation
      table.timestamp('active_from').nullable()
      table.timestamp('active_to').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      // CRITICAL: Index for fast redirect lookups in middleware
      table.index(['from_path', 'locale'])
      table.index('post_id')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
