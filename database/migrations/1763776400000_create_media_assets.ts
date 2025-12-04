import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'media_assets'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.text('url').notNullable()
      table.text('original_filename').notNullable()
      table.text('mime_type').notNullable()
      table.bigInteger('size').notNullable()
      table.text('alt_text').nullable()
      table.text('caption').nullable()
      table.text('description').nullable()
      table.specificType('categories', 'text[]').notNullable().defaultTo('{}')
      table.jsonb('metadata').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
    this.schema.alterTable(this.tableName, (table) => {
      table.index(['mime_type'])
      table.index(['created_at'])
      table.index(['categories'], 'media_assets_categories_idx', { using: 'gin' } as any)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
