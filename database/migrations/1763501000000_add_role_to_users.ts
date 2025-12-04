import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    // Add role column if not exists, defaulting to 'admin'
    await this.schema.raw(`
ALTER TABLE "${this.tableName}"
ADD COLUMN IF NOT EXISTS "role" VARCHAR(20) NOT NULL DEFAULT 'admin';
    `)
  }

  async down() {
    // Safe drop (ignore if missing)
    await this.schema.raw(`
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='${this.tableName}' AND column_name='role'
  ) THEN
    ALTER TABLE "${this.tableName}" DROP COLUMN "role";
  END IF;
END
$$;
    `)
  }
}
