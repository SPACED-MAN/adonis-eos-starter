import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    await this.schema.raw(`
ALTER TABLE ${this.tableName}
  ADD COLUMN IF NOT EXISTS username varchar(50);
    `)
    // Unique (case-insensitive) via functional index
    await this.schema.raw(`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'users_username_lower_unique'
  ) THEN
    CREATE UNIQUE INDEX users_username_lower_unique ON ${this.tableName} (LOWER(username));
  END IF;
END $$;
    `)
  }

  async down() {
    await this.schema.raw(`
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'users_username_lower_unique'
  ) THEN
    DROP INDEX users_username_lower_unique;
  END IF;
END $$;
    `)
    await this.schema.raw(`
ALTER TABLE ${this.tableName}
  DROP COLUMN IF EXISTS username;
    `)
  }
}


