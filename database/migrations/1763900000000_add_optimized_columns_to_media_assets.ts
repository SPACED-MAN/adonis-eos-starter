import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'media_assets'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('optimized_url').nullable()
      table.bigInteger('optimized_size').nullable()
      table.timestamp('optimized_at', { useTz: true }).nullable()
    })
    this.schema.alterTable(this.tableName, (table) => {
      table.index(['optimized_at'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('optimized_url')
      table.dropColumn('optimized_size')
      table.dropColumn('optimized_at')
    })
  }
}
