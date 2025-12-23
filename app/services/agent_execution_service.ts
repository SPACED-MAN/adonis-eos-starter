import AgentExecution, { type ViewMode } from '#models/agent_execution'
import type { HttpContext } from '@adonisjs/core/http'

type SaveExecutionParams = {
  postId: string | null // Nullable for global agents
  agentId: string
  viewMode: ViewMode
  userId?: number | null
  request?: string | null
  response?: {
    rawResponse?: string
    summary?: string
    applied?: string[]
    [key: string]: any
  } | null
  context?: Record<string, any> | null
  scope?: string // Store scope for filtering global agent history
}

class AgentExecutionService {
  /**
   * Save an agent execution to history
   */
  async saveExecution(params: SaveExecutionParams): Promise<AgentExecution> {
    // Include scope in context if provided
    const context = params.context || {}
    if (params.scope) {
      context.scope = params.scope
    }

    return AgentExecution.create({
      postId: params.postId,
      agentId: params.agentId,
      viewMode: params.viewMode,
      userId: params.userId ?? null,
      request: params.request ?? null,
      response: params.response ?? null,
      context: Object.keys(context).length > 0 ? context : null,
    })
  }

  /**
   * Get execution history for a post, optionally filtered by agent and view mode
   * For global agents, postId can be null
   */
  async getHistory(
    postId: string | null,
    options?: {
      agentId?: string
      viewMode?: ViewMode
      limit?: number
      scope?: string // For global agents, filter by scope in context
    }
  ): Promise<AgentExecution[]> {
    const query = AgentExecution.query()

    // If postId is provided, filter by post; otherwise, filter for global agents
    if (postId !== null) {
      query.where('post_id', postId)
    } else {
      // For global agents, postId is null
      query.whereNull('post_id')
      // Optionally filter by scope in context
      if (options?.scope) {
        query.whereRaw("context->>'scope' = ?", [options.scope])
      }
    }

    query.orderBy('created_at', 'desc').preload('user')

    if (options?.agentId) {
      query.where('agent_id', options.agentId)
    }

    if (options?.viewMode) {
      query.where('view_mode', options.viewMode)
    }

    if (options?.limit) {
      query.limit(options.limit)
    }

    return query
  }

  /**
   * When promoting AI Review to Review, copy all AI Review executions to Review
   */
  async promoteAiReviewToReview(postId: string): Promise<void> {
    const executions = await AgentExecution.query()
      .where('post_id', postId)
      .where('view_mode', 'ai-review')

    // Create new executions with view_mode='review' for each AI Review execution
    for (const execution of executions) {
      await AgentExecution.create({
        postId: execution.postId,
        agentId: execution.agentId,
        viewMode: 'review',
        userId: execution.userId,
        request: execution.request,
        response: execution.response,
        context: execution.context,
      })
    }
  }

  /**
   * When promoting Review to Source, copy all Review executions to Source
   */
  async promoteReviewToSource(postId: string): Promise<void> {
    const executions = await AgentExecution.query()
      .where('post_id', postId)
      .where('view_mode', 'review')

    // Create new executions with view_mode='source' for each Review execution
    for (const execution of executions) {
      await AgentExecution.create({
        postId: execution.postId,
        agentId: execution.agentId,
        viewMode: 'source',
        userId: execution.userId,
        request: execution.request,
        response: execution.response,
        context: execution.context,
      })
    }
  }

  /**
   * Log agent execution to activity log
   */
  async logToActivityLog(execution: AgentExecution, auth: HttpContext['auth']): Promise<void> {
    const activityLogService = await import('#services/activity_log_service')
    // For global agents (postId is null), use a different entity type
    const entityType = execution.postId ? 'post' : 'agent'
    const entityId = execution.postId || execution.agentId
    await activityLogService.default.log({
      action: 'agent.executed',
      userId: (auth.use('web').user as any)?.id ?? null,
      entityType,
      entityId,
      metadata: {
        agentId: execution.agentId,
        viewMode: execution.viewMode,
        executionId: execution.id,
        hasResponse: !!execution.response,
        hasSummary: !!execution.response?.summary,
        scope: execution.context?.scope || null,
      },
    })
  }
}

const agentExecutionService = new AgentExecutionService()
export default agentExecutionService
