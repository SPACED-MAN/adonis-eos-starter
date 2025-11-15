import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'url_redirects'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.string('from_path', 1024).notNullable()
      table.string('to_path', 1024).notNullable()
      table.string('locale', 16).nullable()
      table.integer('status_code').notNullable().defaultTo(301)
      table.timestamp('created_at').notNullable().defaultTo(this.db.rawQuery('NOW()').knexQuery)
      table.unique(['from_path', 'locale'])
      table.index(['from_path', 'locale'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}


