import type { HttpContext } from '@adonisjs/core/http'
import workflowRegistry from '#services/workflow_registry'
import workflowExecutionService from '#services/workflow_execution_service'
import roleRegistry from '#services/role_registry'
import type { WorkflowTrigger } from '#types/workflow_types'

export default class WorkflowsController {
  /**
   * GET /api/workflows
   * List all registered workflows
   */
  async index({ request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined

    // Only admins can view workflows
    if (!roleRegistry.hasPermission(role, 'workflows.view')) {
      return response.forbidden({ error: 'Not allowed to view workflows' })
    }

    const workflows = workflowRegistry.list()

    return response.ok({
      data: workflows.map((w) => ({
        id: w.id,
        name: w.name,
        description: w.description,
        type: w.type,
        enabled: w.enabled,
        triggers: w.triggers.map((t) => ({
          trigger: t.trigger,
          order: t.order,
          enabled: t.enabled,
          formSlugs: t.formSlugs,
          postTypes: t.postTypes,
          agentIds: t.agentIds,
          workflowIds: t.workflowIds,
        })),
      })),
    })
  }

  /**
   * GET /api/workflows/:id
   * Get a specific workflow by ID
   */
  async show({ params, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined

    if (!roleRegistry.hasPermission(role, 'workflows.view')) {
      return response.forbidden({ error: 'Not allowed to view workflows' })
    }

    const { id } = params
    const workflow = workflowRegistry.get(id)

    if (!workflow) {
      return response.notFound({ error: 'Workflow not found' })
    }

    return response.ok({
      data: {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        type: workflow.type,
        enabled: workflow.enabled,
        triggers: workflow.triggers,
        webhook: {
          url: workflow.webhook.url,
          method: workflow.webhook.method,
          timeout: workflow.webhook.timeout,
          retryOnFailure: workflow.webhook.retryOnFailure,
          retryAttempts: workflow.webhook.retryAttempts,
          retryDelay: workflow.webhook.retryDelay,
          // Don't expose secrets in API response
        },
      },
    })
  }

  /**
   * POST /api/workflows/:id/trigger
   * Manually trigger a workflow (for testing purposes)
   */
  async trigger({ params, request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined

    // Only admins can manually trigger workflows
    if (!roleRegistry.hasPermission(role, 'workflows.trigger')) {
      return response.forbidden({ error: 'Not allowed to trigger workflows' })
    }

    const { id } = params
    const workflow = workflowRegistry.get(id)

    if (!workflow) {
      return response.notFound({ error: 'Workflow not found' })
    }

    const trigger = (request.input('trigger') as WorkflowTrigger) || 'manual'
    const payload = request.input('payload') || {}
    const context = request.input('context') || {}

    const result = await workflowExecutionService.executeWorkflow(
      workflow,
      trigger,
      payload,
      (auth.use('web').user as any)?.id
    )

    if (result.success) {
      return response.ok({
        message: 'Workflow executed successfully',
        workflowId: result.workflowId,
      })
    } else {
      return response.badRequest({
        error: result.error || 'Workflow execution failed',
        workflowId: result.workflowId,
      })
    }
  }
}

