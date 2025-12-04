import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'posts'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.jsonb('ai_review_draft').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('ai_review_draft')
    })
  }
}