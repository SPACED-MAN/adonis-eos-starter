import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'post_modules'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('review_deleted').notNullable().defaultTo(false)
      table.integer('review_order_index').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('review_order_index')
      table.dropColumn('review_deleted')
    })
  }
}


