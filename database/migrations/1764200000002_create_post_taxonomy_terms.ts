import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'post_taxonomy_terms'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.uuid('post_id').notNullable().references('id').inTable('posts').onDelete('CASCADE')
      table.uuid('taxonomy_term_id').notNullable().references('id').inTable('taxonomy_terms').onDelete('CASCADE')
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.unique(['post_id', 'taxonomy_term_id'])
      table.index(['post_id'])
      table.index(['taxonomy_term_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}



