import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import string from '@adonisjs/core/helpers/string'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export default class MakeTaxonomy extends BaseCommand {
	static commandName = 'make:taxonomy'
	static description = 'Scaffold a new code-first taxonomy config'

	static options: CommandOptions = {
		startApp: false,
	}

	@args.string({ description: 'Taxonomy name (e.g., Categories, Tags)' })
	declare name: string

	@flags.boolean({
		description: 'Whether taxonomy is hierarchical (allows nesting + reorder)',
		default: true,
	})
	declare hierarchical: boolean

	@flags.boolean({
		description: 'Enable free-tagging (create terms inline in the post editor)',
		default: false,
	})
	declare freeTagging: boolean

	@flags.string({
		description: 'Max selections per post (number) or "unlimited"',
		default: 'unlimited',
	})
	declare maxSelections: string

	protected buildConfigContents(slug: string): string {
		const maxSel =
			this.maxSelections === 'unlimited' || this.maxSelections === ''
				? 'null'
				: Number.isFinite(Number(this.maxSelections))
					? Number(this.maxSelections).toString()
					: 'null'

		return `import type { RegisteredTaxonomyConfig } from '#services/taxonomy_registry'

const taxonomy: RegisteredTaxonomyConfig = {
  slug: '${slug}',
  name: '${this.name}',
  hierarchical: ${this.hierarchical ? 'true' : 'false'},
  freeTagging: ${this.freeTagging ? 'true' : 'false'},
  maxSelections: ${maxSel}, // null = unlimited
}

export default taxonomy
`
	}

	async run() {
		const taxKebab = string.snakeCase(this.name).replace(/_/g, '-')
		const slug = taxKebab
		const appRoot = fileURLToPath(this.app.appRoot)
		const configDir = join(appRoot, 'app', 'taxonomies')
		const configPath = join(configDir, `${slug}.ts`)

		try {
			await mkdir(configDir, { recursive: true })
			await writeFile(configPath, this.buildConfigContents(slug), { flag: 'wx' })
			this.logger.success(`Created taxonomy config: app/taxonomies/${slug}.ts`)
			this.logger.info('')
			this.logger.info('Next steps:')
			this.logger.info('  1) Start the dev server or rerun it to sync taxonomies.')
			this.logger.info('  2) Add this taxonomy slug to post type configs (taxonomies: [...]).')
			this.logger.info('  3) Manage terms in the Categories admin or enable free-tagging in the editor.')
		} catch (error) {
			this.logger.error(`Could not create taxonomy file (it may already exist): ${configPath}`)
			if (process.env.DEBUG) this.logger.fatal(error as any)
		}
	}
}

