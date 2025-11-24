import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'post_type_settings'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('hierarchy_enabled').notNullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('hierarchy_enabled')
    })
  }
}


