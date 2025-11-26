import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    await this.schema.raw(`
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='post_type_settings' AND table_schema=current_schema()) THEN
    DROP TABLE post_type_settings;
  END IF;
END $$;
    `)
  }

  async down() {
    // No down migration; legacy table intentionally removed
  }
}




