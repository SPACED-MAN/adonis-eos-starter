import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'posts'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('ab_variation', 10).nullable().defaultTo('A')
      table.uuid('ab_group_id').nullable()
      table.index(['ab_group_id'], 'idx_posts_ab_group')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex([], 'idx_posts_ab_group')
      table.dropColumn('ab_variation')
      table.dropColumn('ab_group_id')
    })
  }
}
