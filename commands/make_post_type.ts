import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import string from '@adonisjs/core/helpers/string'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export default class MakePostType extends BaseCommand {
	static commandName = 'make:post_type'
	static description = 'Scaffold a new post type (migration with default template and URL patterns)'

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

	protected buildMigrationContents(_typeKebab: string, typeSlug: string, pattern: string): string {
		// Ensure pattern contains {post_type} token replaced at generation time
		const resolvedPattern = pattern.replace(/\{post_type\}/g, typeSlug)
		return `import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // Create default template for post type if it does not exist
    await this.schema.raw("INSERT INTO templates (name, post_type, description, locked, created_at, updated_at)\\n" +
      "SELECT '${typeSlug}-default', '${typeSlug}', 'Default template for ${typeSlug}', FALSE, NOW(), NOW()\\n" +
      "WHERE NOT EXISTS (\\n" +
      "  SELECT 1 FROM templates WHERE post_type = '${typeSlug}' AND name = '${typeSlug}-default'\\n" +
      ");")

    // Insert default URL patterns for all enabled locales (fallback to 'en' when locales table missing)
    await this.schema.raw("DO $$\\nBEGIN\\n" +
      "  IF to_regclass('public.locales') IS NOT NULL THEN\\n" +
      "    INSERT INTO url_patterns (post_type, locale, pattern, is_default, created_at, updated_at)\\n" +
      "    SELECT '${typeSlug}', l.code, '${resolvedPattern}', TRUE, NOW(), NOW()\\n" +
      "    FROM locales l\\n" +
      "    WHERE l.is_enabled = TRUE\\n" +
      "      AND NOT EXISTS (\\n" +
      "        SELECT 1 FROM url_patterns up\\n" +
      "        WHERE up.post_type = '${typeSlug}' AND up.locale = l.code AND up.is_default = TRUE\\n" +
      "      );\\n" +
      "  ELSE\\n" +
      "    INSERT INTO url_patterns (post_type, locale, pattern, is_default, created_at, updated_at)\\n" +
      "    SELECT '${typeSlug}', 'en', '${resolvedPattern}', TRUE, NOW(), NOW()\\n" +
      "    WHERE NOT EXISTS (\\n" +
      "      SELECT 1 FROM url_patterns up\\n" +
      "      WHERE up.post_type = '${typeSlug}' AND up.locale = 'en' AND up.is_default = TRUE\\n" +
      "    );\\n" +
      "  END IF;\\n" +
      "END\\n$$;")
  }

  async down() {
    await this.schema.raw("DELETE FROM url_patterns WHERE post_type = '${typeSlug}';")
    await this.schema.raw("DELETE FROM templates WHERE post_type = '${typeSlug}' AND name = '${typeSlug}-default';")
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
		const migrationFile = ts + '_seed_' + typeSlug + '_post_type.ts'
		const migrationPath = join(appRoot, 'database', 'migrations', migrationFile)
		const migrationContent = this.buildMigrationContents(typeKebab, typeSlug, this.pattern)

		await writeFile(migrationPath, migrationContent, 'utf-8')

		this.logger.success(`Created migration for post type "${typeSlug}"`)
		this.logger.info('')
		this.logger.info('Files created:')
		this.logger.info(this.colors.dim(`   Migration: database/migrations/${migrationFile}`))
		this.logger.info('')
		this.logger.info('Next steps:')
		this.logger.info('  1) Run migrations:')
		this.logger.info(this.colors.dim('     node ace migration:run'))
		this.logger.info('  2) Start the dev server:')
		this.logger.info(this.colors.dim('     npm run dev'))
	}
}