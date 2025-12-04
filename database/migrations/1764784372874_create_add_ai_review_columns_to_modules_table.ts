import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // Add AI review columns to module_instances
    this.schema.alterTable('module_instances', (table) => {
      table.jsonb('ai_review_props').nullable()
    })

    // Add AI review columns to post_modules
    this.schema.alterTable('post_modules', (table) => {
      table.jsonb('ai_review_overrides').nullable()
      table.boolean('ai_review_added').defaultTo(false)
      table.boolean('ai_review_deleted').defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable('module_instances', (table) => {
      table.dropColumn('ai_review_props')
    })

    this.schema.alterTable('post_modules', (table) => {
      table.dropColumn('ai_review_overrides')
      table.dropColumn('ai_review_added')
      table.dropColumn('ai_review_deleted')
    })
  }
}