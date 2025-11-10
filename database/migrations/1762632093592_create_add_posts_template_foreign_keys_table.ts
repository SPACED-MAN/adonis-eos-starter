import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'posts'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Add foreign key constraint to templates
      table.foreign('template_id')
        .references('id')
        .inTable('templates')
        .onDelete('SET NULL')
      
      // Add foreign key constraint to users
      table.foreign('user_id')
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['template_id'])
      table.dropForeign(['user_id'])
    })
  }
}