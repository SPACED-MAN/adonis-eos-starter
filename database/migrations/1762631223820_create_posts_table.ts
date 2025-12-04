import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'posts'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)

      table.string('type', 50).notNullable()
      table.string('slug', 255).notNullable()
      table.string('title', 500).notNullable()
      table.text('excerpt').nullable()
      table.uuid('featured_image_id').nullable()

      table
        .enum('status', [
          'draft',
          'review',
          'scheduled',
          'published',
          'private',
          'protected',
          'archived',
        ])
        .notNullable()
        .defaultTo('draft')

      // i18n fields
      table.string('locale', 10).notNullable().defaultTo('en')
      table
        .uuid('translation_of_id')
        .nullable()
        .references('id')
        .inTable('posts')
        .onDelete('CASCADE')
      // Note: FK to locales will be added separately (after locales table migration)

      // SEO fields
      table.string('meta_title', 255).nullable()
      table.text('meta_description').nullable()
      table.string('canonical_url', 500).nullable()
      table.jsonb('robots_json').nullable()
      table.jsonb('jsonld_overrides').nullable()
      // GIN indexes for JSONB (added post-create)

      // Template relationship (nullable)
      table.uuid('template_id').nullable()
      // Note: FK to templates will be added separately (after templates table migration)

      // Creator relationship (who created/owns this post)
      table.integer('user_id').unsigned().notNullable()
      table.foreign('user_id').references('users.id').onDelete('CASCADE')

      // Author relationship (semantic owner for things like Profile)
      table.integer('author_id').unsigned().nullable()
      table.foreign('author_id').references('users.id').onDelete('SET NULL')

      // Hierarchy fields
      table.uuid('parent_id').nullable().references('id').inTable('posts').onDelete('SET NULL')
      table.integer('order_index').notNullable().defaultTo(0)

      // Review draft (JSON snapshot)
      table.jsonb('review_draft').nullable()
      table.jsonb('ai_review_draft').nullable()

      // Publishing timestamps
      table.timestamp('published_at').nullable()
      table.timestamp('scheduled_at').nullable()
      table.timestamp('deleted_at').nullable()

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      // Performance indexes
      table.unique(['slug', 'locale']) // Unique slug per locale
      table.index(['locale', 'status', 'type']) // For filtered content lists
      table.index(['translation_of_id', 'locale']) // For translation lookups
      table.index('template_id') // For template queries
      table.index('user_id') // For user's posts queries
      table.index('author_id') // For author queries
      table.index('featured_image_id') // For media queries
      table.index(['parent_id'])
      table.index(['type', 'parent_id'])
      table.index(['type', 'parent_id', 'order_index'])
    })
    // GIN indexes for JSONB fields (guarded to avoid errors if table creation failed)
    await this.schema.raw(`
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name='posts' AND table_schema = current_schema()
  ) THEN
    CREATE INDEX IF NOT EXISTS posts_robots_json_gin ON posts USING GIN (robots_json);
    CREATE INDEX IF NOT EXISTS posts_jsonld_overrides_gin ON posts USING GIN (jsonld_overrides);
    CREATE INDEX IF NOT EXISTS idx_posts_not_deleted ON posts(id) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_posts_deleted ON posts(deleted_at) WHERE deleted_at IS NOT NULL;
  END IF;
END
$$;
    `)
    // One profile per user (partial unique on author_id)
    await this.schema.raw(`
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name='posts' AND table_schema = current_schema()
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'posts_unique_profile_per_user') THEN
      CREATE UNIQUE INDEX posts_unique_profile_per_user ON posts(author_id) WHERE type = 'profile';
    END IF;
  END IF;
END $$;
    `)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
