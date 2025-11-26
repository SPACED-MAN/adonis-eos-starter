import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'template_modules'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('scope', 20).notNullable().defaultTo('post')
      table.string('global_slug', 255).nullable()
      table.index(['template_id', 'order_index', 'scope'], 'template_modules_scope_idx')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['template_id', 'order_index', 'scope'], 'template_modules_scope_idx')
      table.dropColumn('global_slug')
      table.dropColumn('scope')
    })
  }
}


