import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected postsTable = 'posts'

  async up() {
    this.schema.alterTable(this.postsTable, (table) => {
      table.string('locale', 10).notNullable().alter()
      table
        .foreign('locale')
        .references('locales.code')
        .onUpdate('CASCADE')
        .onDelete('CASCADE')
    })
  }

  async down() {
    this.schema.alterTable(this.postsTable, (table) => {
      table.dropForeign(['locale'])
    })
  }
}



