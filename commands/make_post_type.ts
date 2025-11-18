import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import string from '@adonisjs/core/helpers/string'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export default class MakePostType extends BaseCommand {
	static commandName = 'make:post_type'
	static description = 'Scaffold a new post type (seeder with default template and URL patterns)'

	static options: CommandOptions = {
		startApp: false,
	}

	@args.string({ description: 'Post type name (e.g., Blog, Product, CaseStudy)' })
	declare name: string

	@flags.string({
		description: 'Default URL pattern (use tokens: {locale},{slug},{yyyy},{mm},{dd})',
		default: '/{locale}/{post_type}/{slug}',
	})
	declare pattern: string

	protected buildSeederContents(_typeKebab: string, typeSlug: string, pattern: string): string {
		const resolvedPattern = pattern.replace(/\{post_type\}/g, typeSlug)
		return `import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'

export default class extends BaseSeeder {
  public static environment = ['development', 'production', 'test']

  public async run() {
    const now = new Date()
    const templateName = '${typeSlug}-default'

    // Ensure default template exists
    const existingTemplate = await db.from('templates').where({ name: templateName }).first()
    if (!existingTemplate) {
      await db.table('templates').insert({
        name: templateName,
        post_type: '${typeSlug}',
        description: 'Default template for ${typeSlug}',
        locked: false,
        created_at: now,
        updated_at: now,
      })
    }

    // Get enabled locales, fallback to 'en' when locales table not available
    let locales: Array<{ code: string }> = []
    try {
      locales = await db.from('locales').select('code').where('is_enabled', true)
    } catch {
      locales = [{ code: 'en' }]
    }

    // Insert default URL patterns for missing locales
    const existing = await db.from('url_patterns').where('post_type', '${typeSlug}').select('locale')
    const existingSet = new Set(existing.map((r: any) => r.locale))
    const toInsert = locales
      .map((l) => l.code)
      .filter((code) => !existingSet.has(code))
      .map((code) => ({
        post_type: '${typeSlug}',
        locale: code,
        pattern: '${resolvedPattern}',
        is_default: true,
        created_at: now,
        updated_at: now,
      }))
    if (toInsert.length > 0) {
      await db.table('url_patterns').insert(toInsert)
    }
  }
}
`
	}

	async run() {
		// Keep for future enhancements (e.g., generating type-specific files)
		const typeName = string.pascalCase(this.name)
		const typeKebab = string.snakeCase(this.name).replace(/_/g, '-')
		const typeSlug = typeKebab
		const appRoot = fileURLToPath(this.app.appRoot)
		const ts = Date.now()
		const seederFile = ts + '_' + typeSlug + '_post_type_seeder.ts'
		const seederPath = join(appRoot, 'database', 'seeders', seederFile)
		const seederContent = this.buildSeederContents(typeKebab, typeSlug, this.pattern)

		await writeFile(seederPath, seederContent, 'utf-8')

		this.logger.success(`Created seeder for post type "${typeSlug}"`)
		this.logger.info('')
		this.logger.info('Files created:')
		this.logger.info(this.colors.dim(`   Seeder: database/seeders/${seederFile}`))
		this.logger.info('')
		this.logger.info('Next steps:')
		this.logger.info('  1) Seed the new post type:')
		this.logger.info(this.colors.dim(`     node ace db:seed --files database/seeders/${seederFile}`))
		this.logger.info('  2) Start the dev server:')
		this.logger.info(this.colors.dim('     npm run dev'))
	}
}