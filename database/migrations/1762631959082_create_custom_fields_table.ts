import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'custom_fields'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      
      table.string('slug', 255).notNullable().unique()
      table.string('label', 255).notNullable()
      
      table.enum('field_type', [
        'text',
        'textarea',
        'number',
        'select',
        'multiselect',
        'media',
        'date',
        'url'
      ]).notNullable()
      
      // Configuration like options for select, validation rules, etc.
      table.jsonb('config').nullable()
      
      // Whether this field should have locale-specific values
      table.boolean('translatable').notNullable().defaultTo(false)
      
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
      
      // Performance index for slug lookups
      table.index('slug')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}