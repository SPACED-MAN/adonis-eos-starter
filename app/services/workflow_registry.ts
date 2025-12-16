import type { WorkflowDefinition, WorkflowTrigger, WorkflowTriggerConfig } from '#types/workflow_types'
import env from '#start/env'

/**
 * Central registry for managing workflow definitions
 * Singleton service that provides runtime access to workflow configurations
 */
class WorkflowRegistry {
  private workflows = new Map<string, WorkflowDefinition>()

  /**
   * Register a new workflow definition
   */
  register(definition: WorkflowDefinition): void {
    if (this.workflows.has(definition.id)) {
      throw new Error(`Workflow with ID "${definition.id}" is already registered`)
    }

    // Validate definition
    if (definition.type === 'webhook' && !definition.webhook) {
      throw new Error(`Workflow "${definition.id}" is webhook type but missing webhook config`)
    }

    // Set defaults
    definition.enabled = definition.enabled !== false
    definition.webhook = {
      ...definition.webhook,
      method: definition.webhook.method || 'POST',
      timeout: definition.webhook.timeout || 30000,
      retryOnFailure: definition.webhook.retryOnFailure || false,
      retryAttempts: definition.webhook.retryAttempts || 3,
      retryDelay: definition.webhook.retryDelay || 1000,
    }

    definition.triggers = definition.triggers.map((trigger) => ({
      ...trigger,
      enabled: trigger.enabled !== false,
      order: trigger.order ?? 100,
    }))

    this.workflows.set(definition.id, definition)
  }

  /**
   * Get a workflow by ID
   */
  get(id: string): WorkflowDefinition | undefined {
    return this.workflows.get(id)
  }

  /**
   * List all registered workflows
   */
  list(): WorkflowDefinition[] {
    return Array.from(this.workflows.values())
  }

  /**
   * List all enabled workflows
   */
  listEnabled(): WorkflowDefinition[] {
    return this.list().filter((workflow) => workflow.enabled !== false)
  }

  /**
   * List workflows that should be triggered for a specific event
   * Results are sorted by order (ascending)
   */
  listByTrigger(
    trigger: WorkflowTrigger,
    context?: {
      formSlug?: string
      postType?: string
      agentId?: string
      workflowId?: string
    }
  ): WorkflowDefinition[] {
    return this.listEnabled()
      .map((workflow) => {
        const triggerConfig = workflow.triggers.find(
          (t) => t.trigger === trigger && t.enabled !== false
        )
        return triggerConfig ? { workflow, triggerConfig } : null
      })
      .filter((item): item is { workflow: WorkflowDefinition; triggerConfig: WorkflowTriggerConfig } => {
        if (!item) return false

        // For form.submit trigger, check if this workflow should run for the specific form
        if (trigger === 'form.submit' && context?.formSlug) {
          const { formSlugs } = item.triggerConfig
          // If no formSlugs specified, workflow runs for all forms
          if (!formSlugs || formSlugs.length === 0) return true
          // Otherwise, check if the form slug is in the list
          return formSlugs.includes(context.formSlug)
        }

        // For post triggers, check if this workflow should run for the specific post type
        if (
          trigger.startsWith('post.') &&
          context?.postType &&
          item.triggerConfig.postTypes &&
          item.triggerConfig.postTypes.length > 0
        ) {
          return item.triggerConfig.postTypes.includes(context.postType)
        }

        // For agent.completed trigger, check if this workflow should run for the specific agent
        if (trigger === 'agent.completed' && context?.agentId) {
          const { agentIds } = item.triggerConfig
          // If no agentIds specified, workflow runs for all agents
          if (!agentIds || agentIds.length === 0) return true
          // Otherwise, check if the agent ID is in the list
          return agentIds.includes(context.agentId)
        }

        // For workflow.completed trigger, check if this workflow should run for the specific workflow
        if (trigger === 'workflow.completed' && context?.workflowId) {
          const { workflowIds } = item.triggerConfig
          // If no workflowIds specified, workflow runs for all workflows
          if (!workflowIds || workflowIds.length === 0) return true
          // Otherwise, check if the workflow ID is in the list
          return workflowIds.includes(context.workflowId)
        }

        return true
      })
      .sort((a, b) => (a.triggerConfig.order ?? 100) - (b.triggerConfig.order ?? 100))
      .map((item) => item.workflow)
  }

  /**
   * Get webhook URL for a workflow (respects dev/prod environment)
   */
  getWebhookUrl(workflowId: string): string | null {
    const workflow = this.get(workflowId)
    if (!workflow || workflow.type !== 'webhook' || !workflow.webhook) {
      return null
    }

    // Use dev URL in development if available
    if (env.NODE_ENV === 'development' && workflow.webhook.devUrl) {
      return workflow.webhook.devUrl
    }

    return workflow.webhook.url
  }

  /**
   * Get timeout for a workflow
   */
  getTimeout(workflowId: string): number {
    const workflow = this.get(workflowId)
    if (!workflow || workflow.type !== 'webhook' || !workflow.webhook) {
      return 30000 // Default timeout
    }

    return workflow.webhook.timeout || 30000
  }
}

// Export singleton instance
const workflowRegistry = new WorkflowRegistry()
export default workflowRegistry

