import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'post_custom_field_values'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      
      table.uuid('post_id').notNullable()
        .references('id')
        .inTable('posts')
        .onDelete('CASCADE')
      
      table.uuid('field_id').notNullable()
        .references('id')
        .inTable('custom_fields')
        .onDelete('CASCADE')
      
      // Store the value as JSON to support any field type
      // For translatable fields: { "en": "value", "es": "valor" }
      table.jsonb('value').nullable()
      
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
      
      // Ensure a field has only one value per post
      table.unique(['post_id', 'field_id'])
      
      // Performance: Composite index for fast field value lookups
      table.index(['post_id', 'field_id'])
    })
    
    // GIN index for JSONB value queries
    this.schema.raw('CREATE INDEX post_custom_field_values_value_gin ON post_custom_field_values USING GIN (value)')
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}