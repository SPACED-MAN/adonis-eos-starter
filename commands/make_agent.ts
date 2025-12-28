import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export default class MakeAgent extends BaseCommand {
  static commandName = 'make:agent'
  static description = 'Create a new internal agent definition file'

  static options: CommandOptions = {
    startApp: false,
  }

  @args.string({ description: 'Agent name (e.g., content-enhancer, seo-optimizer)' })
  declare name: string

  /**
   * Convert kebab-case to PascalCase
   */
  private toPascalCase(str: string): string {
    return str
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join('')
  }

  /**
   * Convert kebab-case to Title Case
   */
  private toTitleCase(str: string): string {
    return str
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ')
  }

  async run() {
    const agentId = this.name.toLowerCase().replace(/\s+/g, '-')
    const agentName = this.toPascalCase(agentId)
    const agentTitle = this.toTitleCase(agentId)
    const fileName = `${agentId}.ts`

    const template = this.getInternalTemplate(agentId, agentName, agentTitle)

    // Ensure agents directory exists
    const agentsDir = this.app.makePath('app/agents')
    await mkdir(agentsDir, { recursive: true })

    // Write the file
    const filePath = join(agentsDir, fileName)
    await writeFile(filePath, template)

    this.logger.success(`Agent created: ${this.colors.cyan(filePath)}`)
    this.logger.info('Next steps:')
    this.logger.info(`1. Configure agent settings in ${this.colors.cyan(`app/agents/${fileName}`)}`)
    this.logger.info(`2. The agent will be automatically registered on next server start`)
    this.logger.info(`Note: For webhook-based external automation, use Workflows instead of Agents.`)
  }

  private getInternalTemplate(id: string, name: string, title: string): string {
    return `import type { AgentDefinition } from '#types/agent_types'

/**
 * ${title} Agent
 * Internal AI service-based agent
 */
const ${name}Agent: AgentDefinition = {
  id: '${id}',
  name: '${title}',
  description: 'Add description here',
  enabled: true,

  internal: {
    provider: 'openai',
    model: 'gpt-4o',
    systemPrompt: 'You are a helpful assistant that...',
    options: {
      temperature: 0.7,
      maxTokens: 2000,
    },
  },

  scopes: [
    {
      scope: 'dropdown',
      order: 100,
      enabled: true,
    },
    // Available scopes:
    // - 'dropdown' - Shows up in the agent dropdown menu
    // - 'global' - Floating brain icon button
    // - 'field' - Per-field AI buttons
    // - 'post.publish' - Triggers on post publish
    // - 'form.submit' - Triggers on form submission
  ],
}

export default ${name}Agent
`
  }
}
