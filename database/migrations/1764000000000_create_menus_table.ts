import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'menus'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.string('name', 255).notNullable()
      table.string('slug', 255).notNullable()
      table.string('locale', 10).nullable()
      table.boolean('auto_generate_locales').notNullable().defaultTo(false)
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())
    })
    this.schema.alterTable(this.tableName, (table) => {
      table.index(['slug'])
      table.index(['locale'])
      table.unique(['slug', 'locale'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
