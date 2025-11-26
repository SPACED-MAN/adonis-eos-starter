import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // Add author_id to posts and backfill from user_id
    await this.schema.raw(`
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS author_id integer NULL;
    `)
    // Backfill author_id from user_id
    await this.schema.raw(`
UPDATE posts
SET author_id = user_id
WHERE author_id IS NULL;
    `)
    // Add FK if not present
    await this.schema.raw(`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'posts_author_id_fkey'
  ) THEN
    ALTER TABLE posts
      ADD CONSTRAINT posts_author_id_fkey
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;
    `)
    // Index on author_id
    await this.schema.raw(`
CREATE INDEX IF NOT EXISTS posts_author_id_idx ON posts(author_id);
    `)
    // Unique profile per user (partial unique index)
    await this.schema.raw(`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'posts_unique_profile_per_user'
  ) THEN
    CREATE UNIQUE INDEX posts_unique_profile_per_user ON posts(author_id) WHERE type = 'profile';
  END IF;
END $$;
    `)

    // Add profile_roles_enabled to site_settings for code-first profile role gating
    await this.schema.raw(`
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS profile_roles_enabled jsonb DEFAULT '[]'::jsonb;
    `)
  }

  async down() {
    // Non-destructive: keep columns/indexes; no-op
  }
}


