import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'site_settings'

  async up() {
    // Use IF NOT EXISTS to avoid errors when columns already exist
    await this.schema.raw(`
ALTER TABLE "${this.tableName}"
  ADD COLUMN IF NOT EXISTS "logo_light_media_id" text NULL,
  ADD COLUMN IF NOT EXISTS "logo_dark_media_id" text NULL;
    `)
  }

  async down() {
    // Drop only if exists to be safe
    await this.schema.raw(`
ALTER TABLE "${this.tableName}"
  DROP COLUMN IF EXISTS "logo_light_media_id",
  DROP COLUMN IF EXISTS "logo_dark_media_id";
    `)
  }
}
