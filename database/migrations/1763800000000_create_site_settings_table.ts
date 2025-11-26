import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'site_settings'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.text('site_title').notNullable().defaultTo('My Site')
      table.text('default_meta_description').nullable()
      // Store media IDs for assets (referencing media_assets.id)
      table.text('favicon_media_id').nullable()
      table.text('default_og_media_id').nullable()
      table.text('logo_light_media_id').nullable()
      table.text('logo_dark_media_id').nullable()
      table.timestamp('created_at').notNullable().defaultTo(this.now())
      table.timestamp('updated_at').notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}


