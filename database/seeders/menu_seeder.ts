import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'
import { randomUUID } from 'node:crypto'

export default class extends BaseSeeder {
  async run() {
    const now = new Date()

    // Seed Primary Menu (code-first default site navigation)
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

      // Top-level primary nav items
      const learnMoreId = randomUUID()
      const editorsId = randomUUID()
      const developersId = randomUUID()
      const modulesId = randomUUID()
      const pricingId = randomUUID()
      const downloadId = randomUUID()

      await db.table('menu_items').insert([
        {
          id: learnMoreId,
          menu_id: menuId,
          parent_id: null,
          order_index: 0,
          label: 'Learn More',
          type: 'custom',
          custom_url: '/docs/overview',
          anchor: null,
          target: null,
          rel: null,
          created_at: now,
          updated_at: now,
          kind: 'item',
          locale: 'en',
        },
        {
          id: editorsId,
          menu_id: menuId,
          parent_id: null,
          order_index: 1,
          label: 'For Editors',
          type: 'custom',
          custom_url: '/docs/for-editors',
          anchor: null,
          target: null,
          rel: null,
          created_at: now,
          updated_at: now,
          kind: 'item',
          locale: 'en',
        },
        {
          id: developersId,
          menu_id: menuId,
          parent_id: null,
          order_index: 2,
          label: 'For Developers',
          type: 'custom',
          custom_url: '/docs/for-developers',
          anchor: null,
          target: null,
          rel: null,
          created_at: now,
          updated_at: now,
          kind: 'item',
          locale: 'en',
        },
        {
          id: modulesId,
          menu_id: menuId,
          parent_id: null,
          order_index: 3,
          label: 'Modules',
          type: 'custom',
          custom_url: '/module-catalog',
          anchor: null,
          target: null,
          rel: null,
          created_at: now,
          updated_at: now,
          kind: 'item',
          locale: 'en',
        },
        {
          id: pricingId,
          menu_id: menuId,
          parent_id: null,
          order_index: 4,
          label: 'Pricing',
          type: 'custom',
          custom_url: '/pricing',
          anchor: null,
          target: null,
          rel: null,
          created_at: now,
          updated_at: now,
          kind: 'item',
          locale: 'en',
        },
        {
          id: downloadId,
          menu_id: menuId,
          parent_id: null,
          order_index: 5,
          label: 'Download',
          type: 'custom',
          // Placeholder; point this at your public Git repo when ready
          custom_url: 'https://github.com/your-org/your-repo',
          anchor: null,
          target: '_blank',
          rel: 'noopener noreferrer',
          created_at: now,
          updated_at: now,
          kind: 'item',
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
          label: 'Learn More',
          type: 'custom',
          custom_url: '/docs/overview',
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
          label: 'For Editors',
          type: 'custom',
          custom_url: '/docs/for-editors',
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
          label: 'For Developers',
          type: 'custom',
          custom_url: '/docs/for-developers',
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
          label: 'Modules',
          type: 'custom',
          custom_url: '/module-catalog',
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
          order_index: 4,
          label: 'Pricing',
          type: 'custom',
          custom_url: '/pricing',
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
