import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'ai_settings'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      table.string('default_text_provider').nullable()
      table.string('default_text_model').nullable()
      table.string('default_media_provider').nullable()
      table.string('default_media_model').nullable()
      table.string('default_video_provider').nullable()
      table.string('default_video_model').nullable()

      table.jsonb('options').nullable()

      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
