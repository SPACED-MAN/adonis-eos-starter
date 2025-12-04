import { BaseSchema } from '@adonisjs/lucid/schema'
import db from '@adonisjs/lucid/services/db'
import { randomUUID } from 'node:crypto'

export default class extends BaseSchema {
  async up() {
    const now = new Date()
    // Skip if already seeded
    const existing = await db.from('menus').where('slug', 'primary').first()
    if (existing) return
    const menuId = randomUUID()
    await db.table('menus').insert({
      id: menuId,
      name: 'Primary',
      slug: 'primary',
      locale: 'en',
      template: 'primary',
      meta_json: JSON.stringify({}),
      created_at: now,
      updated_at: now,
    })
    // Seed sample items and a section under the first item
    const homeId = randomUUID()
    const aboutId = randomUUID()
    const servicesId = randomUUID()
    const sectionId = randomUUID()
    await db.table('menu_items').insert([
      {
        id: homeId,
        menu_id: menuId,
        parent_id: null,
        order_index: 0,
        label: 'Home',
        type: 'custom',
        custom_url: '/',
        anchor: null,
        target: null,
        rel: null,
        created_at: now,
        updated_at: now,
        kind: 'item',
        locale: 'en',
      },
      {
        id: aboutId,
        menu_id: menuId,
        parent_id: null,
        order_index: 1,
        label: 'About',
        type: 'custom',
        custom_url: '/about',
        anchor: null,
        target: null,
        rel: null,
        created_at: now,
        updated_at: now,
        kind: 'item',
        locale: 'en',
      },
      {
        id: servicesId,
        menu_id: menuId,
        parent_id: null,
        order_index: 2,
        label: 'Services',
        type: 'custom',
        custom_url: '/services',
        anchor: null,
        target: null,
        rel: null,
        created_at: now,
        updated_at: now,
        kind: 'item',
        locale: 'en',
      },
      {
        id: sectionId,
        menu_id: menuId,
        parent_id: servicesId,
        order_index: 0,
        label: 'Featured',
        type: 'custom',
        custom_url: null,
        anchor: null,
        target: null,
        rel: null,
        created_at: now,
        updated_at: now,
        kind: 'section',
        locale: 'en',
      },
    ])
  }

  async down() {
    const row = await db.from('menus').where('slug', 'primary').first()
    if (!row) return
    await db.from('menu_items').where('menu_id', row.id).delete()
    await db.from('menus').where('id', row.id).delete()
  }
}
