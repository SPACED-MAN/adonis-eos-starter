import { BaseSchema } from '@adonisjs/lucid/schema'
import db from '@adonisjs/lucid/services/db'
import { randomUUID } from 'node:crypto'

export default class extends BaseSchema {
  async up() {
    const now = new Date()
    // Skip if already seeded
    const existing = await db.from('menus').where('slug', 'footer').first()
    if (existing) return

    const menuId = randomUUID()
    await db.table('menus').insert({
      id: menuId,
      name: 'Footer',
      slug: 'footer',
      locale: 'en',
      template: 'footer',
      meta_json: JSON.stringify({}),
      created_at: now,
      updated_at: now,
    })

    // Seed footer links (flat list)
    await db.table('menu_items').insert([
      {
        id: randomUUID(),
        menu_id: menuId,
        parent_id: null,
        order_index: 0,
        label: 'About',
        type: 'custom',
        custom_url: '/about',
        anchor: null,
        target: null,
        rel: null,
        kind: 'item',
        created_at: now,
        updated_at: now,
        locale: 'en',
      },
      {
        id: randomUUID(),
        menu_id: menuId,
        parent_id: null,
        order_index: 1,
        label: 'Blog',
        type: 'custom',
        custom_url: '/blog',
        anchor: null,
        target: null,
        rel: null,
        kind: 'item',
        created_at: now,
        updated_at: now,
        locale: 'en',
      },
      {
        id: randomUUID(),
        menu_id: menuId,
        parent_id: null,
        order_index: 2,
        label: 'FAQs',
        type: 'custom',
        custom_url: '/faqs',
        anchor: null,
        target: null,
        rel: null,
        kind: 'item',
        created_at: now,
        updated_at: now,
        locale: 'en',
      },
      {
        id: randomUUID(),
        menu_id: menuId,
        parent_id: null,
        order_index: 3,
        label: 'Contact',
        type: 'custom',
        custom_url: '/contact',
        anchor: null,
        target: null,
        rel: null,
        kind: 'item',
        created_at: now,
        updated_at: now,
        locale: 'en',
      },
    ])
  }

  async down() {
    const row = await db.from('menus').where('slug', 'footer').first()
    if (!row) return
    await db.from('menu_items').where('menu_id', row.id).delete()
    await db.from('menus').where('id', row.id).delete()
  }
}
