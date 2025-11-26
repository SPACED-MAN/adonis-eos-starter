import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // Add field_slug, backfill from custom_fields, drop FK and old tables
    await this.schema.raw(`
ALTER TABLE post_custom_field_values
  ADD COLUMN IF NOT EXISTS field_slug text;
    `)
    await this.schema.raw(`
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='custom_fields' AND table_schema=current_schema()) THEN
    UPDATE post_custom_field_values v
    SET field_slug = cf.slug
    FROM custom_fields cf
    WHERE v.field_id = cf.id AND (v.field_slug IS NULL OR v.field_slug = '');
  END IF;
END $$;
    `)
    await this.schema.raw(`
ALTER TABLE post_custom_field_values
  ALTER COLUMN field_slug SET NOT NULL;
    `)
    // Ensure uniqueness by (post_id, field_slug)
    await this.schema.raw(`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'post_cfv_post_id_field_slug_unique'
  ) THEN
    CREATE UNIQUE INDEX post_cfv_post_id_field_slug_unique ON post_custom_field_values (post_id, field_slug);
  END IF;
END $$;
    `)
    // Drop old FK and column
    await this.schema.raw(`
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='post_custom_field_values' AND column_name='field_id'
  ) THEN
    ALTER TABLE post_custom_field_values DROP CONSTRAINT IF EXISTS post_custom_field_values_field_id_fkey;
    ALTER TABLE post_custom_field_values DROP COLUMN IF EXISTS field_id;
  END IF;
END $$;
    `)
    // Drop definition tables
    await this.schema.raw(`
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='post_type_custom_fields' AND table_schema=current_schema()) THEN
    DROP TABLE post_type_custom_fields;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='custom_fields' AND table_schema=current_schema()) THEN
    DROP TABLE custom_fields;
  END IF;
END $$;
    `)
  }

  async down() {
    // Irreversible by design (moving definitions to code). No-op.
  }
}




