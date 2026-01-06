import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'post_modules'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('ai_review_order_index').nullable().after('review_order_index')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('ai_review_order_index')
    })
  }
}
