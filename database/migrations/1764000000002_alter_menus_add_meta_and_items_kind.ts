import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected menusTable = 'menus'
  protected itemsTable = 'menu_items'

  async up() {
    this.schema.alterTable(this.menusTable, (table) => {
      table.string('template', 64).nullable()
      table.jsonb('meta_json').notNullable().defaultTo(this.db.rawQuery(`'{}'::jsonb`).knexQuery)
    })
    this.schema.alterTable(this.itemsTable, (table) => {
      table.string('kind', 20).notNullable().defaultTo('item') // 'item' | 'section'
      table.index(['kind'])
    })
  }

  async down() {
    this.schema.alterTable(this.itemsTable, (table) => {
      table.dropIndex(['kind'])
      table.dropColumn('kind')
    })
    this.schema.alterTable(this.menusTable, (table) => {
      table.dropColumn('template')
      table.dropColumn('meta_json')
    })
  }
}


