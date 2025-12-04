import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'menu_items'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Change type enum to include 'dynamic'
      table.dropColumn('type')
    })

    this.schema.alterTable(this.tableName, (table) => {
      // Re-add type with new enum
      table
        .enum('type', ['post', 'custom', 'dynamic'])
        .notNullable()
        .defaultTo('custom')
        .after('label')
      
      // Add dynamic menu fields
      table
        .string('dynamic_post_type', 50)
        .nullable()
        .comment('Post type to dynamically fetch (for type=dynamic)')
        .after('type')
      
      table
        .uuid('dynamic_parent_id')
        .nullable()
        .references('id')
        .inTable('posts')
        .onDelete('SET NULL')
        .comment('Parent post ID to filter children (for hierarchical post types)')
        .after('dynamic_post_type')
      
      table
        .integer('dynamic_depth_limit')
        .nullable()
        .defaultTo(1)
        .comment('Depth limit for hierarchical expansion (1=direct children, 2=grandchildren, etc.)')
        .after('dynamic_parent_id')
    })

    // Add index for dynamic queries
    this.schema.alterTable(this.tableName, (table) => {
      table.index(['type', 'dynamic_post_type'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['type', 'dynamic_post_type'])
      table.dropColumn('dynamic_depth_limit')
      table.dropColumn('dynamic_parent_id')
      table.dropColumn('dynamic_post_type')
      table.dropColumn('type')
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.enum('type', ['post', 'custom']).notNullable().defaultTo('custom')
    })
  }
}
