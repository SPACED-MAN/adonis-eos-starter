import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'posts'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Social fields
      table.string('social_title', 255).nullable()
      table.text('social_description').nullable()
      table.uuid('social_image_id').nullable().references('id').inTable('media_assets').onDelete('SET NULL')

      // Simplified robots toggles
      table.boolean('noindex').notNullable().defaultTo(false)
      table.boolean('nofollow').notNullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('social_title')
      table.dropColumn('social_description')
      table.dropColumn('social_image_id')
      table.dropColumn('noindex')
      table.dropColumn('nofollow')
    })
  }
}
