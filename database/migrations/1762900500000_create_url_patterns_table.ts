import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'url_patterns'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('locale', 16).notNullable().unique()
      // e.g. '/:locale/posts/:slug' or '/posts/:slug'
      table.string('pattern', 255).notNullable()
      table.timestamp('updated_at').notNullable().defaultTo(this.db.rawQuery('NOW()').knexQuery)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}


