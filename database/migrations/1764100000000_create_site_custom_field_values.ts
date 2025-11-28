import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'site_custom_field_values'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.text('field_slug').notNullable().unique()
      table.jsonb('value').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
    this.schema.raw('CREATE INDEX IF NOT EXISTS site_custom_field_values_value_gin ON site_custom_field_values USING GIN (value)')
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}


