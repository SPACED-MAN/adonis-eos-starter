import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'
import { randomUUID } from 'node:crypto'

export default class extends BaseSeeder {
  async run() {
    const now = new Date()

    // Seed Primary Menu
    const existingPrimary = await db.from('menus').where('slug', 'primary').first()
    if (!existingPrimary) {
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

    // Seed Footer Menu
    const existingFooter = await db.from('menus').where('slug', 'footer').first()
    if (!existingFooter) {
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
  }
}
