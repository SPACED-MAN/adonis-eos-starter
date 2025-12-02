import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateFormSubmissionsTable extends BaseSchema {
  protected tableName = 'form_submissions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.string('form_slug').notNullable()
      table.jsonb('payload').notNullable()
      table.string('ip_address').nullable()
      table.string('user_agent').nullable()
      table.timestamps(true, true)

      table.index(['form_slug', 'created_at'], 'idx_form_submissions_form_slug_created_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}



