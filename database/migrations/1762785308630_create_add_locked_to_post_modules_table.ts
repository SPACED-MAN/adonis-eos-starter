import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'post_modules'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('locked').notNullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('locked')
    })
  }
}