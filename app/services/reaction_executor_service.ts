import type { AgentReaction, AgentExecutionContext } from '#types/agent_types'
import mcpClientService from '#services/mcp_client_service'

/**
 * Reaction Executor Service
 *
 * Executes agent reactions based on trigger conditions.
 * Supports webhooks, Slack notifications, emails, MCP tools, and custom handlers.
 */
class ReactionExecutorService {
  /**
   * Execute all reactions for an agent based on execution result
   */
  async executeReactions(
    reactions: AgentReaction[],
    context: AgentExecutionContext,
    result: {
      success: boolean
      data?: any
      error?: Error
    }
  ): Promise<void> {
    if (!reactions || reactions.length === 0) {
      return
    }

    // Execute reactions in parallel (they're independent)
    const promises = reactions
      .filter((reaction) => reaction.enabled !== false)
      .map((reaction) => this.executeReaction(reaction, context, result))

    await Promise.allSettled(promises)
  }

  /**
   * Execute a single reaction
   */
  private async executeReaction(
    reaction: AgentReaction,
    context: AgentExecutionContext,
    result: {
      success: boolean
      data?: any
      error?: Error
    }
  ): Promise<void> {
    // Check if reaction should trigger
    if (!this.shouldTrigger(reaction, result)) {
      return
    }

    try {
      switch (reaction.type) {
        case 'webhook':
          await this.executeWebhookReaction(reaction, context, result)
          break
        case 'slack':
          await this.executeSlackReaction(reaction, context, result)
          break
        case 'email':
          await this.executeEmailReaction(reaction, context, result)
          break
        case 'mcp_tool':
          await this.executeMCPToolReaction(reaction, context, result)
          break
        case 'custom':
          await this.executeCustomReaction(reaction, context, result)
          break
        default:
          console.warn(`Unknown reaction type: ${(reaction as any).type}`)
      }
    } catch (error) {
      // Log but don't throw - reactions shouldn't break agent execution
      console.error(`Failed to execute reaction ${reaction.type}:`, error)
    }
  }

  /**
   * Check if a reaction should trigger
   */
  private shouldTrigger(
    reaction: AgentReaction,
    result: { success: boolean; data?: any; error?: Error }
  ): boolean {
    switch (reaction.trigger) {
      case 'always':
        return true
      case 'on_success':
        return result.success
      case 'on_error':
        return !result.success
      case 'on_condition':
        if (!reaction.condition) return false
        return this.evaluateCondition(reaction.condition, result)
      default:
        return false
    }
  }

  /**
   * Evaluate a condition
   */
  private evaluateCondition(
    condition: AgentReaction['condition'],
    result: { success: boolean; data?: any; error?: Error }
  ): boolean {
    if (!condition) return false

    // Get field value using dot notation
    const fieldValue = this.getNestedValue(result, condition.field)

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value
      case 'contains':
        return String(fieldValue || '').includes(String(condition.value || ''))
      case 'greater_than':
        return Number(fieldValue) > Number(condition.value)
      case 'less_than':
        return Number(fieldValue) < Number(condition.value)
      case 'matches':
        return new RegExp(String(condition.value || '')).test(String(fieldValue || ''))
      case 'exists':
        return fieldValue !== undefined && fieldValue !== null
      default:
        return false
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  /**
   * Interpolate template string with variables
   */
  private interpolate(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = this.getNestedValue(variables, key)
      return value !== undefined && value !== null ? String(value) : match
    })
  }

  /**
   * Execute webhook reaction
   */
  private async executeWebhookReaction(
    reaction: AgentReaction,
    context: AgentExecutionContext,
    result: { success: boolean; data?: any; error?: Error }
  ): Promise<void> {
    const { url, method = 'POST', headers = {}, bodyTemplate } = reaction.config

    if (!url) {
      throw new Error('Webhook URL is required')
    }

    const variables = {
      agent: context.agent,
      scope: context.scope,
      result: result.data,
      error: result.error?.message,
      success: result.success,
      ...context.data,
    }

    let body: any = result.data
    if (bodyTemplate) {
      try {
        body = JSON.parse(this.interpolate(bodyTemplate, variables))
      } catch {
        body = this.interpolate(bodyTemplate, variables)
      }
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`)
    }
  }

  /**
   * Execute Slack reaction
   */
  private async executeSlackReaction(
    reaction: AgentReaction,
    context: AgentExecutionContext,
    result: { success: boolean; data?: any; error?: Error }
  ): Promise<void> {
    const { webhookUrl, channel, template } = reaction.config

    if (!webhookUrl) {
      throw new Error('Slack webhook URL is required')
    }

    const variables = {
      agent: context.agent.name,
      scope: context.scope,
      result: result.data,
      error: result.error?.message,
      success: result.success,
      ...context.data,
    }

    const message = template
      ? this.interpolate(template, variables)
      : `Agent ${context.agent.name} ${result.success ? 'completed successfully' : 'failed'}`

    const payload: any = {
      text: message,
    }

    if (channel) {
      payload.channel = channel
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`Slack webhook failed: ${response.status} ${response.statusText}`)
    }
  }

  /**
   * Execute email reaction
   */
  private async executeEmailReaction(
    _reaction: AgentReaction,
    _context: AgentExecutionContext,
    _result: { success: boolean; data?: any; error?: Error }
  ): Promise<void> {
    // TODO: Implement email sending using AdonisJS mail
  }

  /**
   * Execute MCP tool reaction
   */
  private async executeMCPToolReaction(
    reaction: AgentReaction,
    context: AgentExecutionContext,
    result: { success: boolean; data?: any; error?: Error }
  ): Promise<void> {
    const { toolName, toolParams } = reaction.config

    if (!toolName) {
      throw new Error('MCP tool name is required')
    }

    // Interpolate tool params if it's a template string
    let params: Record<string, any> = {}
    if (typeof toolParams === 'string') {
      try {
        params = JSON.parse(this.interpolate(toolParams, { ...result, ...context.data }))
      } catch {
        throw new Error('Invalid toolParams template')
      }
    } else {
      params = (toolParams as Record<string, any>) || {}
    }

    await mcpClientService.callTool(toolName, params)
  }

  /**
   * Execute custom reaction
   */
  private async executeCustomReaction(
    _reaction: AgentReaction,
    _context: AgentExecutionContext,
    _result: { success: boolean; data?: any; error?: Error }
  ): Promise<void> {
    const { handler } = _reaction.config

    if (!handler) {
      throw new Error('Custom handler path is required')
    }

    // TODO: Implement dynamic handler loading
    // This could load a function from a module path
    console.warn('Custom reaction handlers not yet implemented', { handler })
  }
}

const reactionExecutorService = new ReactionExecutorService()
export default reactionExecutorService
