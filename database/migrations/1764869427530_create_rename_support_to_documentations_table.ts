import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // Update post type from 'support' to 'documentation'
    await this.db.from('posts').where('type', 'support').update({ type: 'documentation' })

    // Update menu slug from 'support' to 'documentation'
    await this.db.from('menus').where('slug', 'support').update({ slug: 'documentation' })

    // Update dynamic menu items that reference support post type
    await this.db
      .from('menu_items')
      .where('dynamic_post_type', 'support')
      .update({ dynamic_post_type: 'documentation' })

    // Update URL patterns from '/support/{slug}' and '/documentation/{slug}' to '/docs/{slug}'
    await this.db
      .from('url_patterns')
      .where('pattern', 'like', '%/support/%')
      .orWhere('pattern', 'like', '%/documentation/%')
      .update({
        pattern: this.db.raw(
          "REPLACE(REPLACE(pattern, '/support/', '/docs/'), '/documentation/', '/docs/')"
        ),
      })
  }

  async down() {
    // Reverse the changes
    await this.db.from('posts').where('type', 'documentation').update({ type: 'support' })
    await this.db.from('menus').where('slug', 'documentation').update({ slug: 'support' })
    await this.db
      .from('menu_items')
      .where('dynamic_post_type', 'documentation')
      .update({ dynamic_post_type: 'support' })
    await this.db
      .from('url_patterns')
      .where('pattern', 'like', '%/docs/%')
      .update({
        pattern: this.db.raw("REPLACE(pattern, '/docs/', '/documentation/')"),
      })
  }
}
