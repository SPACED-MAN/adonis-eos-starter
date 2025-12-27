import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'feedbacks'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.uuid('post_id').notNullable().references('id').inTable('posts').onDelete('CASCADE')
      table
        .integer('user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      
      table.enum('mode', ['approved', 'review', 'ai-review']).notNullable().defaultTo('approved')
      table.text('content').notNullable()
      table.string('type', 50).notNullable().defaultTo('comment') // comment, bug, copy, feature
      table.enum('status', ['pending', 'resolved']).notNullable().defaultTo('pending')
      table.jsonb('context').nullable() // For storing selector, coordinates, etc.

      table.timestamp('created_at').notNullable().defaultTo(this.now())
      table.timestamp('updated_at').notNullable().defaultTo(this.now())

      table.index(['post_id', 'mode'])
      table.index(['status'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

