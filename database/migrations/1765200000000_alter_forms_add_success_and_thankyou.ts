import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'forms'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('success_message').nullable()
      table.uuid('thank_you_post_id').nullable()
      table.index(['thank_you_post_id'], 'idx_forms_thank_you_post_id')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['thank_you_post_id'], 'idx_forms_thank_you_post_id')
      table.dropColumn('success_message')
      table.dropColumn('thank_you_post_id')
    })
  }
}
