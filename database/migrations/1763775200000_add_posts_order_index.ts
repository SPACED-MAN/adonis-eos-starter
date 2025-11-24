import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'posts'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('order_index').notNullable().defaultTo(0)
      table.index(['type', 'parent_id', 'order_index'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['type', 'parent_id', 'order_index'])
      table.dropColumn('order_index')
    })
  }
}


