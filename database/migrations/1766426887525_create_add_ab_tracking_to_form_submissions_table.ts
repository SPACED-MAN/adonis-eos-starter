import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'form_submissions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.uuid('ab_group_id').nullable().index()
      table.string('ab_variation', 10).nullable()
      table.uuid('origin_post_id').nullable().index()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('ab_group_id')
      table.dropColumn('ab_variation')
      table.dropColumn('origin_post_id')
    })
  }
}
