import type {
  WorkflowDefinition,
  WorkflowExecutionContext,
  WorkflowTrigger,
} from '#types/workflow_types'
import workflowRegistry from './workflow_registry'
import db from '@adonisjs/lucid/services/db'

/**
 * Workflow Execution Service
 * Handles execution of workflows triggered by various events
 */
class WorkflowExecutionService {
  /**
   * Execute workflows for a specific trigger event
   */
  async executeWorkflows(
    trigger: WorkflowTrigger,
    payload: Record<string, any>,
    context?: {
      formSlug?: string
      postType?: string
      agentId?: string
      workflowId?: string
      userId?: number
    }
  ): Promise<Array<{ workflowId: string; success: boolean; error?: string }>> {
    const workflows = workflowRegistry.listByTrigger(trigger, context)

    if (workflows.length === 0) {
      return []
    }

    const results = await Promise.allSettled(
      workflows.map(async (workflow) => {
        // Check trigger condition if provided
        const triggerConfig = workflow.triggers.find((t) => t.trigger === trigger)
        if (triggerConfig?.condition) {
          const conditionResult = await triggerConfig.condition(payload)
          if (!conditionResult) {
            return { workflowId: workflow.id, success: false, skipped: true }
          }
        }

        // Execute the workflow
        return await this.executeWorkflow(workflow, trigger, payload, context?.userId)
      })
    )

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        return {
          workflowId: workflows[index].id,
          success: false,
          error: result.reason?.message || 'Workflow execution failed',
        }
      }
    })
  }

  /**
   * Execute a single workflow
   */
  async executeWorkflow(
    workflow: WorkflowDefinition,
    trigger: WorkflowTrigger,
    payload: Record<string, any>,
    userId?: number
  ): Promise<{ workflowId: string; success: boolean; error?: string; skipped?: boolean }> {
    if (workflow.type !== 'webhook') {
      return {
        workflowId: workflow.id,
        success: false,
        error: `Unsupported workflow type: ${workflow.type}`,
      }
    }

    const webhookUrl = workflowRegistry.getWebhookUrl(workflow.id)
    if (!webhookUrl) {
      return {
        workflowId: workflow.id,
        success: false,
        error: 'Webhook URL not configured',
      }
    }

    // Transform payload if transformation function is provided
    let finalPayload = payload
    if (workflow.transformPayload) {
      try {
        finalPayload = await workflow.transformPayload(payload)
      } catch (error: any) {
        return {
          workflowId: workflow.id,
          success: false,
          error: `Payload transformation failed: ${error?.message}`,
        }
      }
    }

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(workflow.webhook.headers || {}),
    }

    // Add authentication
    if (workflow.webhook.secret) {
      if (workflow.webhook.secretHeader) {
        headers[workflow.webhook.secretHeader] = workflow.webhook.secret
      } else {
        headers['Authorization'] = `Bearer ${workflow.webhook.secret}`
      }
    }

    // Get timeout
    const timeout = workflowRegistry.getTimeout(workflow.id)

    // Execute webhook with retry logic
    const maxAttempts = workflow.webhook.retryOnFailure ? workflow.webhook.retryAttempts || 3 : 1

    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)

        const response = await fetch(webhookUrl, {
          method: workflow.webhook.method || 'POST',
          headers,
          body: JSON.stringify(finalPayload),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const text = await response.text().catch(() => '')
          throw new Error(`HTTP ${response.status}: ${text}`)
        }

        // Success - log execution
        await this.logExecution(workflow.id, trigger, userId, {
          success: true,
          attempt,
          statusCode: response.status,
        })

        return { workflowId: workflow.id, success: true }
      } catch (error: any) {
        lastError = error

        // If this is the last attempt, don't retry
        if (attempt >= maxAttempts) {
          break
        }

        // Wait before retrying
        const delay = workflow.webhook.retryDelay || 1000
        await new Promise((resolve) => setTimeout(resolve, delay * attempt)) // Exponential backoff
      }
    }

    // All attempts failed - log execution
    await this.logExecution(workflow.id, trigger, userId, {
      success: false,
      error: lastError?.message || 'Unknown error',
    })

    return {
      workflowId: workflow.id,
      success: false,
      error: lastError?.message || 'Workflow execution failed',
    }
  }

  /**
   * Log workflow execution to database
   */
  private async logExecution(
    workflowId: string,
    trigger: WorkflowTrigger,
    userId: number | undefined,
    result: {
      success: boolean
      attempt?: number
      statusCode?: number
      error?: string
    }
  ): Promise<void> {
    try {
      await db.table('workflow_executions').insert({
        workflow_id: workflowId,
        trigger,
        user_id: userId || null,
        success: result.success,
        status_code: result.statusCode || null,
        error_message: result.error || null,
        attempt: result.attempt || 1,
        created_at: new Date(),
        updated_at: new Date(),
      } as any)
    } catch (error) {
      // Don't fail workflow execution if logging fails
      console.error('Failed to log workflow execution:', error)
    }
  }
}

// Export singleton instance
const workflowExecutionService = new WorkflowExecutionService()
export default workflowExecutionService
