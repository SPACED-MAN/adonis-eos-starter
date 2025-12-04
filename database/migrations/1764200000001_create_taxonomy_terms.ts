import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'taxonomy_terms'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table
        .uuid('taxonomy_id')
        .notNullable()
        .references('id')
        .inTable('taxonomies')
        .onDelete('CASCADE')
      table
        .uuid('parent_id')
        .nullable()
        .references('id')
        .inTable('taxonomy_terms')
        .onDelete('SET NULL')
      table.string('slug', 150).notNullable()
      table.string('name', 200).notNullable()
      table.text('description').nullable()
      table.integer('order_index').notNullable().defaultTo(0)
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
    this.schema.alterTable(this.tableName, (table) => {
      table.index(['taxonomy_id'])
      table.index(['taxonomy_id', 'parent_id'])
      table.index(['parent_id'])
      table.index(['slug'])
      table.unique(['taxonomy_id', 'slug'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
