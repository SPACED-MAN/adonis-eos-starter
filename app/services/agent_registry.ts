import type { AgentDefinition, AgentScope, AgentScopeConfig } from '#types/agent_types'

/**
 * Central registry for managing agent definitions
 * Singleton service that provides runtime access to agent configurations
 */
class AgentRegistry {
  private agents = new Map<string, AgentDefinition>()

  /**
   * Register a new agent definition
   */
  register(definition: AgentDefinition): void {
    if (this.agents.has(definition.id)) {
      throw new Error(`Agent with ID "${definition.id}" is already registered`)
    }

    // Validate definition
    if (!definition.internal) {
      throw new Error(`Agent "${definition.id}" is missing internal config`)
    }

    // Set defaults
    definition.enabled = definition.enabled !== false
    definition.scopes = definition.scopes.map((scope) => ({
      ...scope,
      enabled: scope.enabled !== false,
      order: scope.order ?? 100,
    }))

    this.agents.set(definition.id, definition)
  }

  /**
   * Get an agent by ID
   */
  get(id: string): AgentDefinition | undefined {
    return this.agents.get(id)
  }

  /**
   * List all registered agents
   */
  list(): AgentDefinition[] {
    return Array.from(this.agents.values())
  }

  /**
   * List all enabled agents
   */
  listEnabled(): AgentDefinition[] {
    return this.list().filter((agent) => agent.enabled !== false)
  }

  /**
   * List agents available in a specific scope
   * Results are sorted by order (ascending)
   */
  listByScope(
    scope: AgentScope,
    formSlug?: string,
    fieldKey?: string,
    fieldType?: string
  ): AgentDefinition[] {
    return this.listEnabled()
      .map((agent) => {
        const scopeConfig = agent.scopes.find((s) => s.scope === scope && s.enabled !== false)
        return scopeConfig ? { agent, scopeConfig } : null
      })
      .filter((item): item is { agent: AgentDefinition; scopeConfig: AgentScopeConfig } => {
        if (!item) return false

        // For form.submit scope, check if this agent should run for the specific form
        if (scope === 'form.submit' && formSlug) {
          const { formSlugs } = item.scopeConfig
          // If no formSlugs specified, agent runs for all forms
          if (!formSlugs || formSlugs.length === 0) return true
          // Otherwise, check if the form slug is in the list
          return formSlugs.includes(formSlug)
        }

        // For field scope, check if the agent is allowed for the specific field key and type
        if (scope === 'field') {
          const keys = (item.scopeConfig as any).fieldKeys as string[] | undefined
          const types = (item.scopeConfig as any).fieldTypes as string[] | undefined

          // Check field key restriction
          if (fieldKey && keys && keys.length > 0) {
            if (!keys.includes(fieldKey)) return false
          }

          // Check field type restriction
          if (fieldType && types && types.length > 0) {
            if (!types.includes(fieldType)) return false
          }
        }

        return true
      })
      .sort((a, b) => (a.scopeConfig.order ?? 100) - (b.scopeConfig.order ?? 100))
      .map((item) => item.agent)
  }

  /**
   * Check if an agent is available in a specific scope
   */
  isAvailableInScope(agentId: string, scope: AgentScope, formSlug?: string): boolean {
    const agents = this.listByScope(scope, formSlug)
    return agents.some((agent) => agent.id === agentId)
  }

  /**
   * Clear all registered agents (useful for testing)
   */
  clear(): void {
    this.agents.clear()
  }
}

const agentRegistry = new AgentRegistry()
export default agentRegistry
