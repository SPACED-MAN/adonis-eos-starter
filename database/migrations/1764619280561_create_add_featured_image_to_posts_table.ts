import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'posts'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.uuid('featured_image_id').nullable().after('excerpt')
      table.foreign('featured_image_id').references('id').inTable('media_assets').onDelete('SET NULL')
      table.index('featured_image_id')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['featured_image_id'])
      table.dropIndex('featured_image_id')
      table.dropColumn('featured_image_id')
    })
  }
}