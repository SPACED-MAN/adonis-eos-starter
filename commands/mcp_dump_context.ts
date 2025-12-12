import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import moduleRegistry from '#services/module_registry'
import postTypeRegistry from '#services/post_type_registry'
import postTypeConfigService from '#services/post_type_config_service'
import taxonomyService from '#services/taxonomy_service'
import fs from 'node:fs/promises'

export default class McpDumpContext extends BaseCommand {
  static commandName = 'mcp:dump-context'
  static description =
    'Dump code-derived MCP context (post types, module schemas, taxonomies) as JSON for documentation/auditing'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({
    description: 'Optional output path. When omitted, prints JSON to stdout.',
  })
  declare out?: string

  async run() {
    const postTypes = postTypeRegistry.list()
    const postTypeConfigs = Object.fromEntries(postTypes.map((t) => [t, postTypeConfigService.getUiConfig(t)]))

    const modules = moduleRegistry.getAllSchemas()
    const taxonomies = await taxonomyService.listTaxonomies()

    const payload = {
      generatedAt: new Date().toISOString(),
      postTypes,
      postTypeConfigs,
      modules,
      taxonomies,
    }

    const json = JSON.stringify(payload, null, 2)

    if (this.out) {
      await fs.writeFile(this.out, json, 'utf-8')
      this.logger.success(`Wrote MCP context dump to ${this.out}`)
      return
    }

    // Intentional: this is a CLI dump command.
    // eslint-disable-next-line no-console
    console.log(json)
  }
}


