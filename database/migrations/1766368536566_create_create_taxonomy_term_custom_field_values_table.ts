import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'taxonomy_term_custom_field_values'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table
        .uuid('term_id')
        .notNullable()
        .references('id')
        .inTable('taxonomy_terms')
        .onDelete('CASCADE')
      table.string('field_slug').notNullable()
      table.jsonb('value').nullable()

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['term_id', 'field_slug'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
