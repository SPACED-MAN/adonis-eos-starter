import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export default class MakeAgent extends BaseCommand {
  static commandName = 'make:agent'
  static description = 'Create a new agent definition file'

  static options: CommandOptions = {
    startApp: false,
  }

  @args.string({ description: 'Agent name (e.g., content-enhancer, seo-optimizer)' })
  declare name: string

  @flags.boolean({ description: 'Create an internal agent instead of external' })
  declare internal: boolean

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

    // Determine template based on type
    const template = this.internal
      ? this.getInternalTemplate(agentId, agentName, agentTitle)
      : this.getExternalTemplate(agentId, agentName, agentTitle)

    // Ensure agents directory exists
    const agentsDir = this.app.makePath('app/agents')
    await mkdir(agentsDir, { recursive: true })

    // Write the file
    const filePath = join(agentsDir, fileName)
    await writeFile(filePath, template)

    this.logger.success(`Agent created: ${this.colors.cyan(filePath)}`)
    this.logger.info('Next steps:')
    this.logger.info(`1. Configure agent settings in ${this.colors.cyan(`app/agents/${fileName}`)}`)
    this.logger.info(`2. Set environment variables (if using external agent)`)
    this.logger.info(`3. The agent will be automatically registered on next server start`)
  }

  private getExternalTemplate(id: string, name: string, title: string): string {
    const envPrefix = id.toUpperCase().replace(/-/g, '_')

    return `import type { AgentDefinition } from '#types/agent_types'

/**
 * ${title} Agent
 * External webhook-based agent
 */
const ${name}Agent: AgentDefinition = {
  id: '${id}',
  name: '${title}',
  description: 'Add description here',
  type: 'external',
  enabled: true,

  external: {
    // Production webhook URL
    url: process.env.AGENT_${envPrefix}_URL || '',

    // Development webhook URL (optional)
    devUrl: process.env.AGENT_${envPrefix}_DEV_URL,

    // Authentication
    secret: process.env.AGENT_${envPrefix}_SECRET,
    secretHeader: 'X-Agent-Secret', // Optional: defaults to Authorization: Bearer

    // Timeout in milliseconds
    timeout: 30000,
  },

  scopes: [
    {
      scope: 'dropdown',
      order: 100,
      enabled: true,
    },
    // Available scopes:
    // - 'dropdown' - Shows up in the agent dropdown menu
    // - 'post.publish' - Triggers on post publish
    // - 'post.approve' - Triggers when approving changes (Approved mode)
    // - 'post.review.save' - Triggers when saving for review
    // - 'post.review.approve' - Triggers when approving review draft
    // - 'post.ai-review.save' - Triggers when saving AI review
    // - 'post.ai-review.approve' - Triggers when approving AI review
    // - 'form.submit' - Triggers on form submission
  ],
}

export default ${name}Agent
`
  }

  private getInternalTemplate(id: string, name: string, title: string): string {
    return `import type { AgentDefinition } from '#types/agent_types'

/**
 * ${title} Agent
 * Internal AI service-based agent (placeholder for future implementation)
 */
const ${name}Agent: AgentDefinition = {
  id: '${id}',
  name: '${title}',
  description: 'Add description here',
  type: 'internal',
  enabled: false, // Enable when internal service is implemented

  internal: {
    serviceId: 'openai', // or 'anthropic', 'custom', etc.
    model: 'gpt-4',
    options: {
      temperature: 0.7,
      maxTokens: 2000,
      // Add other model-specific options here
    },
  },

  scopes: [
    {
      scope: 'dropdown',
      order: 100,
      enabled: false,
    },
    // Available scopes:
    // - 'dropdown' - Shows up in the agent dropdown menu
    // - 'post.publish' - Triggers on post publish
    // - 'post.approve' - Triggers when approving changes (Approved mode)
    // - 'post.review.save' - Triggers when saving for review
    // - 'post.review.approve' - Triggers when approving review draft
    // - 'post.ai-review.save' - Triggers when saving AI review
    // - 'post.ai-review.approve' - Triggers when approving AI review
    // - 'form.submit' - Triggers on form submission
  ],
}

export default ${name}Agent
`
  }
}
