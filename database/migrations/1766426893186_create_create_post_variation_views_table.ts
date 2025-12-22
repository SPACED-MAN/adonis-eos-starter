import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'post_variation_views'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.uuid('post_id').notNullable().references('posts.id').onDelete('CASCADE')
      table.uuid('ab_group_id').nullable().index()
      table.string('ab_variation', 10).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      
      table.index(['post_id', 'created_at'])
      table.index(['ab_group_id', 'created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
