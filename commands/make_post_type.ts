import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import string from '@adonisjs/core/helpers/string'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export default class MakePostType extends BaseCommand {
  static commandName = 'make:post-type'
  static description = 'Scaffold a new code-first post type config'

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

  protected buildConfigContents(_typeSlug: string): string {
    return `export default {
  // Hide core fields in the editor for this post type
  // Allowed: 'title' | 'excerpt' | 'parent' | 'slug' | 'meta' | 'seo'
  hideCoreFields: [],

  // Enable/disable hierarchy (parent selector, reorder)
  hierarchyEnabled: true,

  // Custom fields attached to this post type (definitions only; values are stored per post)
  // Supported types: 'text' | 'textarea' | 'number' | 'select' | 'multiselect' | 'media' | 'date' | 'url'
  // Example:
  // fields: [
  //   { slug: 'subtitle', label: 'Subtitle', type: 'text' },
  //   { slug: 'hero_image', label: 'Hero image', type: 'media', config: { category: 'Hero images', preferredVariant: 'wide' } },
  // ],
  fields: [],

  // Default template metadata (synced on boot)
  template: { name: '${_typeSlug}-default', description: 'Default template for ${_typeSlug}' },

  // URL patterns (synced on boot)
  // Tokens: {locale}, {slug}, {yyyy}, {mm}, {dd}
  urlPatterns: [
    { locale: 'en', pattern: '${this.pattern.replace(/\{post_type\}/g, _typeSlug)}', isDefault: true },
  ],
} as const
`
  }

  async run() {
    // Keep for future enhancements (e.g., generating type-specific files)
    const typeKebab = string.snakeCase(this.name).replace(/_/g, '-')
    const typeSlug = typeKebab
    const appRoot = fileURLToPath(this.app.appRoot)
    // Post type config file
    const configDir = join(appRoot, 'app', 'post_types')
    const configPath = join(configDir, `${typeSlug}.ts`)
    try {
      // ensure dir
      await mkdir(configDir, { recursive: true })
      await writeFile(configPath, this.buildConfigContents(typeSlug), { flag: 'wx' })
    } catch {
      // If file exists, skip
    }

    this.logger.success(`Created code-first post type "${typeSlug}"`)
    this.logger.info('')
    this.logger.info('Files created:')
    this.logger.info(this.colors.dim(`   Config: app/post_types/${typeSlug}.ts`))
    this.logger.info('')
    this.logger.info('Next steps:')
    this.logger.info('  1) Start the dev server:')
    this.logger.info(this.colors.dim('     npm run dev'))
    this.logger.info('  (The boot sync will create/update the default template and URL patterns.)')
  }
}
