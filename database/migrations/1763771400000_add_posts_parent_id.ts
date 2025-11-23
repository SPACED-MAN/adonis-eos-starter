import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'posts'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.uuid('parent_id').nullable()
        .references('id')
        .inTable('posts')
        .onDelete('SET NULL')
      table.index(['parent_id'])
      table.index(['type', 'parent_id'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['type', 'parent_id'])
      table.dropIndex(['parent_id'])
      table.dropForeign(['parent_id'])
      table.dropColumn('parent_id')
    })
  }
}



