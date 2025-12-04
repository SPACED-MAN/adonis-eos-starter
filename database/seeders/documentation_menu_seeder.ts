import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'
import { randomUUID } from 'node:crypto'

export default class extends BaseSeeder {
  async run() {
    // Check if Documentation menu already exists
    const existingMenu = await db.from('menus').where('slug', 'documentation').first()
    if (existingMenu) {
      console.log('📋 Documentation menu already exists, skipping')
      return
    }

    console.log('📋 Creating Documentation menu...')

    const menuId = randomUUID()
    const now = new Date()

    // Create Documentation menu
    await db.table('menus').insert({
      id: menuId,
      name: 'Documentation',
      slug: 'documentation',
      locale: 'en',
      template: null,
      meta_json: JSON.stringify({}),
      created_at: now,
      updated_at: now,
    })

    console.log('   ✓ Created menu: Documentation')

    // Create dynamic menu item for all documentation
    await db.table('menu_items').insert({
      id: randomUUID(),
      menu_id: menuId,
      parent_id: null,
      locale: 'en',
      order_index: 0,
      label: 'Documentation',
      type: 'dynamic',
      post_id: null,
      custom_url: null,
      anchor: null,
      target: null,
      rel: null,
      kind: 'item',
      dynamic_post_type: 'documentation',
      dynamic_parent_id: null, // null = all top-level posts
      dynamic_depth_limit: 2, // Include 2 levels of hierarchy
      created_at: now,
      updated_at: now,
    })

    console.log('   ✓ Created dynamic menu item: Documentation (type=documentation, depth=2)')
    console.log('✅ Documentation menu setup complete!')
  }
}
