import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Add soft deletes and preview token support
 *
 * This migration adds:
 * 1. Soft delete support via deleted_at column
 * 2. Preview token storage for secure draft sharing
 * 3. Webhook configuration table
 */
export default class extends BaseSchema {
  async up() {
    // Add soft delete to posts
    this.schema.alterTable('posts', (table) => {
      table.timestamp('deleted_at').nullable()
    })

    // Create preview tokens table
    this.schema.createTable('preview_tokens', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('post_id').notNullable().references('id').inTable('posts').onDelete('CASCADE')
      table.string('token', 64).notNullable().unique()
      table.timestamp('expires_at').notNullable()
      table.integer('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      table.timestamp('created_at').notNullable().defaultTo(this.now())
      
      // Index for token lookups
      table.index(['token', 'expires_at'], 'idx_preview_tokens_lookup')
    })

    // Create webhooks table
    this.schema.createTable('webhooks', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.string('name', 100).notNullable()
      table.string('url', 500).notNullable()
      table.string('secret', 255).nullable()
      table.specificType('events', 'text[]').notNullable().defaultTo('{}')
      table.boolean('active').notNullable().defaultTo(true)
      table.jsonb('headers').nullable()
      table.integer('timeout_ms').notNullable().defaultTo(5000)
      table.integer('max_retries').notNullable().defaultTo(3)
      table.timestamp('last_triggered_at').nullable()
      table.string('last_status', 50).nullable()
      table.timestamp('created_at').notNullable().defaultTo(this.now())
      table.timestamp('updated_at').notNullable().defaultTo(this.now())

      // Index for active webhooks by event
      table.index(['active'], 'idx_webhooks_active')
    })

    // Create webhook delivery log
    this.schema.createTable('webhook_deliveries', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('webhook_id').notNullable().references('id').inTable('webhooks').onDelete('CASCADE')
      table.string('event', 100).notNullable()
      table.jsonb('payload').notNullable()
      table.integer('response_status').nullable()
      table.text('response_body').nullable()
      table.integer('duration_ms').nullable()
      table.integer('attempt').notNullable().defaultTo(1)
      table.string('status', 20).notNullable().defaultTo('pending') // pending, success, failed, retrying
      table.text('error').nullable()
      table.timestamp('created_at').notNullable().defaultTo(this.now())

      // Index for webhook delivery history
      table.index(['webhook_id', 'created_at'], 'idx_webhook_deliveries_history')
    })

    // Add indexes for soft delete queries
    this.schema.raw(`
      CREATE INDEX idx_posts_not_deleted ON posts(id) WHERE deleted_at IS NULL;
      CREATE INDEX idx_posts_deleted ON posts(deleted_at) WHERE deleted_at IS NOT NULL;
    `)
  }

  async down() {
    // Drop indexes
    this.schema.raw('DROP INDEX IF EXISTS idx_posts_not_deleted')
    this.schema.raw('DROP INDEX IF EXISTS idx_posts_deleted')

    // Drop tables
    this.schema.dropTableIfExists('webhook_deliveries')
    this.schema.dropTableIfExists('webhooks')
    this.schema.dropTableIfExists('preview_tokens')

    // Remove soft delete column
    this.schema.alterTable('posts', (table) => {
      table.dropColumn('deleted_at')
    })
  }
}

