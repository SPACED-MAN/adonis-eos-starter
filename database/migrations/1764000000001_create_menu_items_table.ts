import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'menu_items'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.uuid('menu_id').notNullable().references('id').inTable('menus').onDelete('CASCADE')
      table.uuid('parent_id').nullable().references('id').inTable('menu_items').onDelete('SET NULL')
      table.string('locale', 10).notNullable().defaultTo('en')
      table.integer('order_index').notNullable().defaultTo(0)
      table.text('label').notNullable()
      table.enum('type', ['post', 'custom']).notNullable().defaultTo('custom')
      table.uuid('post_id').nullable().references('id').inTable('posts').onDelete('SET NULL')
      table.text('custom_url').nullable()
      table.text('anchor').nullable()
      table.text('target').nullable() // e.g. _blank
      table.text('rel').nullable() // e.g. nofollow noopener
      table.string('kind', 20).notNullable().defaultTo('item') // 'item' | 'section'
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())
    })
    this.schema.alterTable(this.tableName, (table) => {
      table.index(['menu_id'])
      table.index(['menu_id', 'locale'])
      table.index(['menu_id', 'locale', 'parent_id'])
      table.index(['parent_id'])
      table.index(['order_index'])
      table.index(['type'])
      table.index(['kind'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
