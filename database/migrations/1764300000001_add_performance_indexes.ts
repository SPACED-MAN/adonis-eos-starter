import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Add performance indexes for common query patterns
 *
 * Based on analysis of controller query patterns.
 */
export default class extends BaseSchema {
  async up() {
    // Composite index for dashboard filtering and sorting
    this.schema.raw(`
      CREATE INDEX IF NOT EXISTS idx_posts_dashboard 
      ON posts(type, status, locale, updated_at DESC)
      WHERE deleted_at IS NULL;
    `)

    // Index for author lookups (profile, reassignment)
    this.schema.raw(`
      CREATE INDEX IF NOT EXISTS idx_posts_author_type 
      ON posts(author_id, type)
      WHERE author_id IS NOT NULL AND deleted_at IS NULL;
    `)

    // Index for translation family lookups
    this.schema.raw(`
      CREATE INDEX IF NOT EXISTS idx_posts_translation_locale 
      ON posts(translation_of_id, locale)
      WHERE translation_of_id IS NOT NULL AND deleted_at IS NULL;
    `)

    // Index for hierarchy queries
    this.schema.raw(`
      CREATE INDEX IF NOT EXISTS idx_posts_parent_order 
      ON posts(parent_id, order_index)
      WHERE deleted_at IS NULL;
    `)

    // Index for scheduled post queries
    this.schema.raw(`
      CREATE INDEX IF NOT EXISTS idx_posts_scheduled 
      ON posts(status, scheduled_at)
      WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND deleted_at IS NULL;
    `)

    // Index for revision history queries
    this.schema.raw(`
      CREATE INDEX IF NOT EXISTS idx_post_revisions_history 
      ON post_revisions(post_id, created_at DESC);
    `)

    // Index for module instance global lookups
    this.schema.raw(`
      CREATE INDEX IF NOT EXISTS idx_module_instances_global 
      ON module_instances(global_slug)
      WHERE scope = 'global' AND global_slug IS NOT NULL;
    `)

    // Index for activity log queries
    this.schema.raw(`
      CREATE INDEX IF NOT EXISTS idx_activity_logs_entity 
      ON activity_logs(entity_type, entity_id, created_at DESC);
    `)

    // Index for activity log user queries
    this.schema.raw(`
      CREATE INDEX IF NOT EXISTS idx_activity_logs_user 
      ON activity_logs(user_id, created_at DESC)
      WHERE user_id IS NOT NULL;
    `)
  }

  async down() {
    this.schema.raw('DROP INDEX IF EXISTS idx_posts_dashboard')
    this.schema.raw('DROP INDEX IF EXISTS idx_posts_author_type')
    this.schema.raw('DROP INDEX IF EXISTS idx_posts_translation_locale')
    this.schema.raw('DROP INDEX IF EXISTS idx_posts_parent_order')
    this.schema.raw('DROP INDEX IF EXISTS idx_posts_scheduled')
    this.schema.raw('DROP INDEX IF EXISTS idx_post_revisions_history')
    this.schema.raw('DROP INDEX IF EXISTS idx_module_instances_global')
    this.schema.raw('DROP INDEX IF EXISTS idx_activity_logs_entity')
    this.schema.raw('DROP INDEX IF EXISTS idx_activity_logs_user')
  }
}
