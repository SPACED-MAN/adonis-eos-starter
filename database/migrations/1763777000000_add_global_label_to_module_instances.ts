import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'module_instances'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('global_label').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('global_label')
    })
  }
}


