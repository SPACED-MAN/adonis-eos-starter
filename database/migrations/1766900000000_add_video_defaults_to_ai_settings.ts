import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'ai_settings'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('default_video_provider').nullable().after('default_media_model')
      table.string('default_video_model').nullable().after('default_video_provider')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('default_video_provider')
      table.dropColumn('default_video_model')
    })
  }
}

