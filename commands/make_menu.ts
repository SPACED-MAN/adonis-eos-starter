import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import string from '@adonisjs/core/helpers/string'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export default class MakeMenu extends BaseCommand {
  static commandName = 'make:menu'
  static description = 'Scaffold a new code-first menu template (and optional seeder)'

  static options: CommandOptions = {
    startApp: false,
  }

  @args.string({ description: 'Menu name (e.g., Primary, Footer, SupportNav)' })
  declare name: string

  @flags.boolean({
    description: 'Also create a database seeder with a sample menu and items',
    alias: 's',
    default: false,
  })
  declare withSeed: boolean

  protected buildTemplateContents(slug: string, displayName: string, pascalId: string): string {
    return `import menuTemplates, { type MenuTemplate } from '#services/menu_template_registry'

export const ${pascalId}: MenuTemplate = {
  slug: '${slug}',
  name: '${displayName}',
  description: '${displayName} navigation.',
  fields: [
    { key: 'tagline', label: 'Tagline', type: 'text' },
    { key: 'ctaText', label: 'CTA Text', type: 'text' },
    { key: 'ctaUrl', label: 'CTA URL', type: 'url' },
    { key: 'showSearch', label: 'Show search', type: 'boolean' },
  ],
  render: {
    variant: 'primary',
    sections: [
      { key: 'featured', label: 'Featured area' },
      { key: 'links', label: 'Links area' },
    ],
  },
}

menuTemplates.register(${pascalId})

export default ${pascalId}
`
  }

  protected buildSeederContents(slug: string, displayName: string): string {
    return `import BaseSeeder from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'
import { randomUUID } from 'node:crypto'

export default class extends BaseSeeder {
  async run() {
    const menuId = randomUUID()
    const now = new Date()
    await db.table('menus').insert({
      id: menuId,
      name: '${displayName}',
      slug: '${slug}',
      locale: 'en',
      template: '${slug}',
      meta_json: JSON.stringify({ tagline: '${displayName} tagline', ctaText: 'Get Started', ctaUrl: '/contact', showSearch: true }),
      created_at: now,
      updated_at: now,
    })
    const topId = randomUUID()
    const sectionId = randomUUID()
    const childId = randomUUID()
    await db.table('menu_items').insert([
      { id: topId, menu_id: menuId, parent_id: null, order_index: 0, label: '${displayName} Item', type: 'custom', custom_url: '/', locale: 'en', kind: 'item', created_at: now, updated_at: now },
      { id: sectionId, menu_id: menuId, parent_id: topId, order_index: 0, label: 'Section', type: 'custom', custom_url: null, locale: 'en', kind: 'section', created_at: now, updated_at: now },
      { id: childId, menu_id: menuId, parent_id: sectionId, order_index: 0, label: 'Child Link', type: 'custom', custom_url: '/about', locale: 'en', kind: 'item', created_at: now, updated_at: now },
    ])
  }
}
`
  }

  async run() {
    const menuName = this.name.trim()
    const displayName = menuName.charAt(0).toUpperCase() + menuName.slice(1)
    const slug = string.snakeCase(menuName).replace(/_/g, '-')
    const pascalId = `${string.pascalCase(slug)}MenuTemplate`
    const appRoot = fileURLToPath(this.app.appRoot)

    // Ensure directory
    const menusDir = join(appRoot, 'app', 'menus')
    await mkdir(menusDir, { recursive: true })

    // Write template file
    const templatePath = join(menusDir, `${slug}.ts`)
    await writeFile(templatePath, this.buildTemplateContents(slug, displayName, pascalId), {
      flag: 'wx',
    }).catch(() => {})

    // Optional seeder
    if (this.withSeed) {
      const seedersDir = join(appRoot, 'database', 'seeders')
      await mkdir(seedersDir, { recursive: true })
      const seederPath = join(seedersDir, `menu_${slug}_seeder.ts`)
      await writeFile(seederPath, this.buildSeederContents(slug, displayName), {
        flag: 'wx',
      }).catch(() => {})
    }

    this.logger.success(`Created code-first menu "${displayName}" (${slug})`)
    this.logger.info('')
    this.logger.info('Files created:')
    this.logger.info(this.colors.dim(`   Template: app/menus/${slug}.ts`))
    if (this.withSeed) {
      this.logger.info(this.colors.dim(`   Seeder:   database/seeders/menu_${slug}_seeder.ts`))
    }
    this.logger.info('')
    this.logger.info('Next steps:')
    this.logger.info('  1) Restart the dev server:')
    this.logger.info(this.colors.dim('     npm run dev'))
    this.logger.info(
      this.colors.dim('     (Template will be automatically discovered and registered)')
    )
    this.logger.info('  2) Open Admin → Menus; fields should appear under "Menu Fields".')
    if (this.withSeed) {
      this.logger.info('  3) Optionally run the seeder: node ace db:seed')
    }
  }
}
