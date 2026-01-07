import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
	protected tableName = 'posts'

	async up() {
		// 1. Rename column if it exists
		await this.schema.raw(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='posts' AND column_name='featured_image_id') THEN
          ALTER TABLE posts RENAME COLUMN featured_image_id TO featured_media_id;
        END IF;
      END $$;
    `)

		// 2. Rename the foreign key constraint if it exists
		await this.schema.raw(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'posts_featured_image_id_foreign') THEN
          ALTER TABLE posts RENAME CONSTRAINT posts_featured_image_id_foreign TO posts_featured_media_id_foreign;
        END IF;
      END $$;
    `)

		// Rename the index if it exists (Lucid/Knex usually generates index names like posts_featured_image_id_index)
		await this.schema.raw(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'posts_featured_image_id_index') THEN
          ALTER INDEX posts_featured_image_id_index RENAME TO posts_featured_media_id_index;
        ELSIF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'posts_featured_image_id_foreign') THEN
          -- Sometimes Knex uses _foreign for indices too
          ALTER INDEX posts_featured_image_id_foreign RENAME TO posts_featured_media_id_index;
        END IF;
      END $$;
    `)
	}

	async down() {
		// Revert the index name
		await this.schema.raw(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'posts_featured_media_id_index') THEN
          ALTER INDEX posts_featured_media_id_index RENAME TO posts_featured_image_id_index;
        END IF;
      END $$;
    `)

		// Revert the constraint name
		await this.schema.raw(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'posts_featured_media_id_foreign') THEN
          ALTER TABLE posts RENAME CONSTRAINT posts_featured_media_id_foreign TO posts_featured_image_id_foreign;
        END IF;
      END $$;
    `)

		// Revert the column name
		await this.schema.raw(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='posts' AND column_name='featured_media_id') THEN
          ALTER TABLE posts RENAME COLUMN featured_media_id TO featured_image_id;
        END IF;
      END $$;
    `)
	}
}
