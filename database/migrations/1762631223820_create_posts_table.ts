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
      
      table.enum('status', ['draft', 'review', 'scheduled', 'published', 'archived'])
        .notNullable()
        .defaultTo('draft')
      
      // i18n fields
      table.string('locale', 10).notNullable().defaultTo('en')
      table.uuid('translation_of_id').nullable()
        .references('id')
        .inTable('posts')
        .onDelete('CASCADE')
      
      // SEO fields
      table.string('meta_title', 255).nullable()
      table.text('meta_description').nullable()
      table.string('canonical_url', 500).nullable()
      table.jsonb('robots_json').nullable()
      table.jsonb('jsonld_overrides').nullable()
      
      // Template relationship (nullable, will add FK after templates is created)
      table.uuid('template_id').nullable()
      
      // User relationship (author - FK will be added later)
      table.integer('user_id').unsigned().notNullable()
      
      // Publishing timestamps
      table.timestamp('published_at').nullable()
      table.timestamp('scheduled_at').nullable()
      
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
      
      // Performance indexes
      table.unique(['slug', 'locale']) // Unique slug per locale
      table.index(['locale', 'status', 'type']) // For filtered content lists
      table.index(['translation_of_id', 'locale']) // For translation lookups
      table.index('template_id') // For template queries
      table.index('user_id') // For user's posts queries
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}