import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'post_type_settings'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)

      // Post type identifier
      table.string('post_type', 50).notNullable().unique()

      // Settings stored as JSONB for flexibility
      table.jsonb('settings').notNullable().defaultTo('{}')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      // Index for quick lookups
      table.index('post_type')
    })

    // GIN index for JSONB settings queries
    this.schema.raw(
      'CREATE INDEX post_type_settings_settings_gin ON post_type_settings USING GIN (settings)'
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
