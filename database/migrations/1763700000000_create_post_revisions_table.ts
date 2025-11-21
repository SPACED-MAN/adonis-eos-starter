import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'post_revisions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.uuid('post_id').notNullable().references('id').inTable('posts').onDelete('CASCADE')
      table.integer('user_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')
      table.enum('mode', ['approved', 'review']).notNullable().defaultTo('approved')
      table.jsonb('snapshot').notNullable()
      table.timestamp('created_at').notNullable().defaultTo(this.now())
      table.index(['post_id', 'created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}


