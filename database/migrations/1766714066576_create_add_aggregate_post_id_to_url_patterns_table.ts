import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'url_patterns'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.uuid('aggregate_post_id').nullable().references('id').inTable('posts').onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('aggregate_post_id')
    })
  }
}
