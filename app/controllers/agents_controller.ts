import type { HttpContext } from '@adonisjs/core/http'
import agentRegistry from '#services/agent_registry'
import PostSerializerService from '#services/post_serializer_service'
import Post from '#models/post'
import roleRegistry from '#services/role_registry'
import RevisionService from '#services/revision_service'
import PostSnapshotService from '#services/post_snapshot_service'
import AgentPostPayloadDto from '#dtos/agent_post_payload_dto'
import agentExecutor from '#services/agent_executor'
import type { AgentExecutionContext, AgentScope } from '#types/agent_types'
import moduleRegistry from '#services/module_registry'
import agentExecutionService from '#services/agent_execution_service'
import { coerceJsonObject } from '../helpers/jsonb.js'
import env from '#start/env'

export default class AgentsController {
  /**
   * GET /api/posts/:id/agents/:agentId/history
   * Get execution history for an agent on a specific post
   */
  async getHistory({ params, response }: HttpContext) {
    const { id, agentId } = params
    const executions = await agentExecutionService.getHistory(id, {
      agentId,
      limit: 50, // Limit to last 50 executions
    })
    return response.ok({
      data: executions.map((e) => ({
        id: e.id,
        agentId: e.agentId,
        viewMode: e.viewMode,
        request: e.request,
        response: e.response,
        context: e.context,
        createdAt: e.createdAt,
        user: e.user
          ? {
              id: e.user.id,
              email: e.user.email,
              fullName: e.user.fullName,
            }
          : null,
      })),
    })
  }

  /**
   * GET /api/agents/:agentId/history
   * Get execution history for a global-scoped agent (no post ID)
   */
  async getGlobalHistory({ params, request, response }: HttpContext) {
    const { agentId } = params
    const scope = (request.input('scope') as string | undefined) || 'global'
    const executions = await agentExecutionService.getHistory(null, {
      agentId,
      scope,
      limit: 50, // Limit to last 50 executions
    })
    return response.ok({
      data: executions.map((e) => ({
        id: e.id,
        agentId: e.agentId,
        viewMode: e.viewMode,
        request: e.request,
        response: e.response,
        context: e.context,
        createdAt: e.createdAt,
        user: e.user
          ? {
              id: e.user.id,
              email: e.user.email,
              fullName: e.user.fullName,
            }
          : null,
      })),
    })
  }

  /**
   * GET /api/agents
   * List configured agents.
   * Query params: ?scope=dropdown|global|field (optional, if omitted returns all)
   */
  async index({ request, response }: HttpContext) {
    const scope = request.input('scope') as AgentScope | undefined
    const fieldType = request.input('fieldType') as string | undefined
    const fieldKey = request.input('fieldKey') as string | undefined

    let agents: any[] = []

    if (scope) {
      agents = agentRegistry.listByScope(scope, undefined, fieldKey, fieldType)
    } else {
      agents = agentRegistry.list()
    }

    const mappedAgents = agents.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      openEndedContext: a.openEndedContext?.enabled
        ? {
            enabled: true,
            label: a.openEndedContext.label,
            placeholder: a.openEndedContext.placeholder,
            maxChars: a.openEndedContext.maxChars,
          }
        : { enabled: false },
      // Include ALL enabled scopes for the UI to display
      scopes: a.scopes
        .filter((s: any) => s.enabled !== false)
        .map((s: any) => ({
          scope: s.scope,
          order: s.order,
          enabled: s.enabled,
          fieldTypes: (s as any).fieldTypes,
          fieldKeys: (s as any).fieldKeys,
        })),
    }))

    return response.ok({ data: mappedAgents })
  }

  /**
   * POST /api/posts/:id/agents/:agentId/run
   * Send current post (canonical JSON) to agent webhook and apply suggestions into review_draft
   * Body: { context?: any }
   */
  async runForPost({ params, request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined
    // Editors and admins can run agents; translators cannot alter review drafts globally
    if (!roleRegistry.hasPermission(role, 'agents.edit')) {
      return response.forbidden({ error: 'Not allowed to run agents' })
    }
    const { id, agentId } = params
    const agent = agentRegistry.get(agentId)
    if (!agent) return response.notFound({ error: 'Agent not found' })

    // Extract scope from request context
    const requestContext = request.input('context') || {}
    const scope =
      (requestContext.scope as 'dropdown' | 'global' | 'field' | 'posts.bulk' | undefined) ||
      'dropdown'
    const fieldKey = requestContext.fieldKey as string | undefined
    const fieldType = requestContext.fieldType as string | undefined

    // Check if agent is available in the requested scope
    const availableAgents = agentRegistry.listByScope(scope, undefined, fieldKey, fieldType)
    if (!availableAgents.some((a) => a.id === agentId)) {
      return response.forbidden({ error: `Agent not available for ${scope} scope` })
    }

    try {
      const result = await this._runAgentForPost(id, agent, auth, {
        scope: scope as any,
        fieldKey,
        fieldType,
        context: requestContext,
        openEndedContext: request.input('openEndedContext'),
      })

      return response.ok(result)
    } catch (e: any) {
      console.error('Agent execution error:', {
        agentId,
        error: e?.message,
        stack: e?.stack,
        name: e?.name,
      })
      return response.badRequest({
        error: e?.message || 'Failed to run agent',
        details: process.env.NODE_ENV === 'development' ? e?.stack : undefined,
      })
    }
  }

  /**
   * POST /api/posts/bulk-agents/:agentId/run
   * Run an agent on a list of posts
   * Body: { ids: string[], context?: any, openEndedContext?: string }
   */
  async runBulk({ params, request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined
    if (!roleRegistry.hasPermission(role, 'agents.edit')) {
      return response.forbidden({ error: 'Not allowed to run agents' })
    }
    const { agentId } = params
    const agent = agentRegistry.get(agentId)
    if (!agent) return response.notFound({ error: 'Agent not found' })

    const {
      ids,
      context: requestContext = {},
      openEndedContext,
    } = request.only(['ids', 'context', 'openEndedContext'])
    if (!Array.isArray(ids) || ids.length === 0) {
      return response.badRequest({ error: 'Post IDs are required' })
    }

    // Check scope
    const availableAgents = agentRegistry.listByScope('posts.bulk')
    if (!availableAgents.some((a) => a.id === agentId)) {
      return response.forbidden({ error: `Agent not available for posts.bulk scope` })
    }

    const results = []
    for (const id of ids) {
      try {
        const result = await this._runAgentForPost(id, agent, auth, {
          scope: 'posts.bulk',
          context: requestContext,
          openEndedContext,
        })
        results.push({ id, success: true, result })
      } catch (e: any) {
        results.push({ id, success: false, error: e.message })
      }
    }

    return response.ok({
      message: `Executed agent on ${ids.length} posts`,
      results,
    })
  }

  /**
   * Internal helper to execute an agent on a specific post
   */
  private async _runAgentForPost(
    id: string,
    agent: any,
    auth: HttpContext['auth'],
    options: {
      scope: AgentScope
      viewMode?: 'source' | 'review' | 'ai-review'
      openEndedContext?: string
      context?: Record<string, any>
      fieldKey?: string
      fieldType?: string
    }
  ) {
    const {
      scope,
      fieldKey,
      fieldType,
      context: ctx = {},
      openEndedContext: rawOpenEnded,
    } = options

    await Post.findOrFail(id)
    const viewMode = (options.viewMode || ctx.viewMode || 'source') as
      | 'source'
      | 'review'
      | 'ai-review'
    const canonical = await PostSerializerService.serialize(id, viewMode)
    const openEndedContext =
      typeof rawOpenEnded === 'string' && rawOpenEnded.trim() ? rawOpenEnded.trim() : undefined

    // Check if we should reset history for this execution
    const resetHistory = ctx.resetHistory === true || ctx.resetContext === true

    // Server-side enforcement: only allow openEndedContext if the agent explicitly opts in
    if (openEndedContext) {
      const enabled = agent.openEndedContext?.enabled === true
      if (!enabled) {
        throw new Error('This agent does not accept open-ended context')
      }
      const max = agent.openEndedContext?.maxChars
      if (
        typeof max === 'number' &&
        Number.isFinite(max) &&
        max > 0 &&
        openEndedContext.length > max
      ) {
        throw new Error(`Open-ended context exceeds maxChars (${max})`)
      }
    }

    const payload = new AgentPostPayloadDto(canonical, {
      ...ctx,
      ...(openEndedContext ? { openEndedContext } : {}),
    })

    if (!agent.llmConfig) {
      throw new Error('Agent missing configuration')
    }

    // Fetch history for context awareness (last 5 turns)
    const historyExecutions = resetHistory
      ? []
      : await agentExecutionService.getHistory(id, {
          agentId: agent.id,
          limit: 5,
        })

    const history: Array<{ role: 'user' | 'assistant'; content: string }> = []
    // Items are returned in desc order (newest first), so we reverse to build chronological conversation
    for (const e of [...historyExecutions].reverse()) {
      if (e.request) {
        history.push({ role: 'user', content: e.request })
      }
      if (e.response?.rawResponse) {
        history.push({ role: 'assistant', content: e.response.rawResponse })
      }
    }

    // Build execution context
    const executionContext: AgentExecutionContext = {
      agent,
      scope: scope as any,
      userId: (auth.use('web').user as any)?.id,
      data: {
        postId: id,
        post: canonical,
        fieldKey,
        fieldType,
        ...ctx,
      },
      history,
    }

    // Execute agent
    const result = await agentExecutor.execute(agent, executionContext, payload)

    if (!result.success) {
      throw result.error || new Error('Agent execution failed')
    }

    const suggestions = result.data || {}
    const rawResponse = (result as any).rawResponse
    const summary = (result as any).summary
    const determination = (result as any).determination
    const lastCreatedPostId = (result as any).lastCreatedPostId

    // Extract generated mediaId from tool results (if image was generated)
    let generatedMediaId: string | undefined = undefined
    let generatedMediaUrl: string | undefined = undefined
    let generatedDarkUrl: string | undefined = undefined
    let imageGenerationFailed = false
    if (suggestions.toolResults && Array.isArray(suggestions.toolResults)) {
      const generateImageResult = suggestions.toolResults.find(
        (r: any) => r.tool === 'generate_image' || r.tool_name === 'generate_image'
      )
      if (generateImageResult) {
        if (generateImageResult.success && generateImageResult.result?.mediaId) {
          generatedMediaId = generateImageResult.result.mediaId
          generatedMediaUrl = generateImageResult.result.url
          generatedDarkUrl = generateImageResult.result.darkUrl
        } else {
          imageGenerationFailed = true
        }
      }
    }

    const suggestedPost: any = (suggestions && suggestions.post) || {}
    const suggestedModules: any[] = Array.isArray(suggestions?.modules) ? suggestions.modules : []

    // For field-scoped agents, automatically place generated media or direct value in the target field
    if (scope === 'field' && fieldKey) {
      const suggestedValue = generatedMediaId || suggestions.value || suggestions.content || suggestions.text

      if (suggestedValue !== undefined) {
        if (fieldKey === 'post.featuredImageId' || fieldKey.startsWith('post.')) {
          const k = fieldKey.startsWith('post.') ? fieldKey.slice(5) : fieldKey
          suggestedPost[k] = suggestedValue
        } else if (fieldKey.startsWith('module.')) {
          const fieldKeyParts = fieldKey.split('.')
          if (fieldKeyParts.length >= 3) {
            const moduleType = fieldKeyParts[1]
            const fieldName = fieldKeyParts.slice(2).join('.')
            const contextModuleInstanceId = (ctx as any).moduleInstanceId

            let moduleUpdate = suggestedModules.find((m: any) => {
              if (m.type !== moduleType) return false
              if (contextModuleInstanceId && m.moduleInstanceId !== contextModuleInstanceId)
                return false
              return true
            })

            if (!moduleUpdate) {
              moduleUpdate = { type: moduleType, props: {} }
              if (contextModuleInstanceId) moduleUpdate.moduleInstanceId = contextModuleInstanceId
              suggestedModules.push(moduleUpdate)
            }

            const fieldParts = fieldName.split('.')
            let currentProps: any = moduleUpdate.props
            for (let i = 0; i < fieldParts.length - 1; i++) {
              if (!currentProps[fieldParts[i]]) currentProps[fieldParts[i]] = {}
              currentProps = currentProps[fieldParts[i]]
            }
            currentProps[fieldParts[fieldParts.length - 1]] = suggestedValue
          }
        }
      }
    }

    // Replace placeholders
    if (generatedMediaId || imageGenerationFailed) {
      const replacePlaceholders = (obj: any): any => {
        if (typeof obj === 'string') {
          const placeholderPatterns = [
            /mediaId\s+from\s+generate_image\s+result/i,
            /<mediaId\s+from\s+generate_image\s+result>/i,
            /GENERATED_IMAGE_ID/i,
            /<GENERATED_IMAGE_ID>/i,
            /CALL_TOOL_generate_image_\d+\.mediaId/i,
            /\{\{tool_code\.generate_image_\d+\}\}/i,
            /\{\{tool\.generate_image\.\d+\.mediaId\}\}/i,
            'mediaId from generate_image result',
            '<mediaId from generate_image result>',
          ]
          for (const pattern of placeholderPatterns) {
            if (
              (typeof pattern === 'string' && obj.toLowerCase().includes(pattern.toLowerCase())) ||
              (pattern instanceof RegExp && pattern.test(obj))
            ) {
              return imageGenerationFailed ? null : generatedMediaId
            }
          }
          return obj
        } else if (Array.isArray(obj)) {
          return obj.map(replacePlaceholders).filter((item) => item !== null)
        } else if (obj && typeof obj === 'object') {
          const replacedObj: any = {}
          for (const key in obj) {
            const replaced = replacePlaceholders(obj[key])
            if (replaced !== null) replacedObj[key] = replaced
          }
          return replacedObj
        }
        return obj
      }

      Object.keys(suggestedPost).forEach((key) => {
        const replaced = replacePlaceholders(suggestedPost[key])
        if (replaced === null) delete suggestedPost[key]
        else suggestedPost[key] = replaced
      })

      suggestedModules.forEach((module, index) => {
        suggestedModules[index] = replacePlaceholders(module)
      })
    }

    let redirectPostId = suggestions.redirectPostId
    if (!redirectPostId && lastCreatedPostId && lastCreatedPostId !== id) {
      redirectPostId = lastCreatedPostId
    }

    const isRedirecting = !!(redirectPostId && redirectPostId !== id)
    const finalSuggestedPost = isRedirecting ? {} : suggestions.post || {}
    const finalSuggestedModules = isRedirecting
      ? []
      : (Array.isArray(suggestions?.modules) ? suggestions.modules : []).filter(
          (m: any) =>
            (m.props && Object.keys(m.props).length > 0) ||
            (m.overrides && Object.keys(m.overrides).length > 0)
        )

    const targetViewMode = scope === 'field' ? viewMode : 'ai-review'
    const snapshot = await PostSerializerService.serialize(id, viewMode)
    const applied: string[] = []

    if (finalSuggestedPost && Object.keys(finalSuggestedPost).length > 0) {
      for (const key of Object.keys(finalSuggestedPost)) {
        if (finalSuggestedPost[key] !== undefined) {
          ;(snapshot.post as any)[key] = finalSuggestedPost[key]
          applied.push(`post.${key}`)
        }
      }
    }

    if (finalSuggestedModules.length > 0) {
      for (const suggestedModule of finalSuggestedModules) {
        const matches = snapshot.modules.filter((m) => {
          if (suggestedModule.postModuleId && m.postModuleId === suggestedModule.postModuleId)
            return true
          if (
            suggestedModule.moduleInstanceId &&
            m.moduleInstanceId === suggestedModule.moduleInstanceId
          )
            return true
          if (suggestedModule.type && m.type === suggestedModule.type) {
            if (suggestedModule.orderIndex !== undefined) {
              return m.orderIndex === suggestedModule.orderIndex
            }
            return true
          }
          return false
        })

        for (const matchingModule of matches) {
          const isGlobal = matchingModule.scope === 'global'
          if (suggestedModule.props) {
            if (isGlobal) {
              matchingModule.overrides = {
                ...coerceJsonObject(matchingModule.overrides),
                ...suggestedModule.props,
              }
            } else {
              matchingModule.props = {
                ...coerceJsonObject(matchingModule.props),
                ...suggestedModule.props,
              }
            }
          }
          if (suggestedModule.overrides) {
            matchingModule.overrides = {
              ...coerceJsonObject(matchingModule.overrides),
              ...suggestedModule.overrides,
            }
          }
          let label = matchingModule.type
          try {
            if (moduleRegistry.has(matchingModule.type))
              label = moduleRegistry.getSchema(matchingModule.type).name
          } catch {}
          applied.push(`${label} [${matchingModule.orderIndex}]`)
        }
      }
    }

    if (applied.length > 0) {
      await PostSnapshotService.apply(id, snapshot, targetViewMode)
      await RevisionService.record({
        postId: id,
        mode: targetViewMode === 'source' ? 'approved' : targetViewMode,
        snapshot: snapshot as any,
        userId: (auth.use('web').user as any)?.id,
      })
    }

    const hasToolChanges =
      Array.isArray(suggestions.toolResults) &&
      suggestions.toolResults.some(
        (r: any) =>
          r.success &&
          [
            'save_post_ai_review',
            'add_module_to_post_ai_review',
            'update_post_module_ai_review',
            'remove_post_module_ai_review',
            'create_post_ai_review',
            'create_translation_ai_review',
          ].includes(r.tool || r.tool_name)
      )

    const responseData: any = {
      message:
        applied.length > 0 || hasToolChanges
          ? scope === 'field'
            ? 'Suggestions applied to the current version'
            : 'Suggestions saved to AI review draft'
          : isRedirecting
            ? 'Translation complete. View the new post to see changes.'
            : 'Agent completed successfully',
      applied,
      suggestions,
      executionMeta: (result as any).executionMeta,
      transcript: (result as any).transcript,
    }

    if (isRedirecting) responseData.redirectPostId = redirectPostId
    if (rawResponse) responseData.rawResponse = rawResponse
    if (summary) responseData.summary = summary
    if (determination) responseData.determination = determination
    if (generatedMediaId) responseData.generatedMediaId = generatedMediaId
    if (generatedMediaUrl) responseData.generatedMediaUrl = generatedMediaUrl
    if (generatedDarkUrl) responseData.generatedDarkUrl = generatedDarkUrl

    // Save execution history
    try {
      const execution = await agentExecutionService.saveExecution({
        postId: id,
        agentId: agent.id,
        viewMode,
        userId: (auth.use('web').user as any)?.id ?? null,
        request: openEndedContext ?? null,
        response: {
          rawResponse,
          summary,
          determination,
          applied,
          generatedMediaId,
          generatedMediaUrl,
          generatedDarkUrl,
          executionMeta: (result as any).executionMeta,
          transcript: (result as any).transcript,
        },
        context: ctx,
        scope: scope || 'dropdown',
      })
      await agentExecutionService.logToActivityLog(execution, auth)
    } catch (historyError: any) {
      console.error('Failed to save agent execution history:', {
        agentId: agent.id,
        postId: id,
        error: historyError?.message,
      })
    }

    return responseData
  }

  /**
   * POST /api/agents/:agentId/run
   * Run a global-scoped agent (doesn't require a post ID)
   * Body: { context?: any, openEndedContext?: string }
   */
  async runGlobal({ params, request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined
    // Editors and admins can run agents; translators cannot alter review drafts globally
    if (!roleRegistry.hasPermission(role, 'agents.edit')) {
      return response.forbidden({ error: 'Not allowed to run agents' })
    }
    const { agentId } = params
    const agent = agentRegistry.get(agentId)
    if (!agent) return response.notFound({ error: 'Agent not found' })

    // Extract scope from request context
    const requestContext = request.input('context') || {}
    const scope = (requestContext.scope as 'dropdown' | 'global' | 'field' | undefined) || 'global'
    const fieldKey = requestContext.fieldKey as string | undefined
    const fieldType = requestContext.fieldType as string | undefined

    // Check if agent is available in the requested scope
    const availableAgents = agentRegistry.listByScope(scope, undefined, fieldKey, fieldType)
    if (!availableAgents.some((a) => a.id === agentId)) {
      return response.forbidden({ error: `Agent not available for ${scope} scope` })
    }

    // For global agents, we might need to create a post or work with a default context
    // For now, we'll return an error if the agent tries to modify content without a post ID
    // In the future, we could create a new post here if the user requests it

    try {
      const openEnded = request.input('openEndedContext')
      const openEndedContext =
        typeof openEnded === 'string' && openEnded.trim() ? openEnded.trim() : undefined

      // Check if we should reset history for this execution
      const resetHistory = requestContext.resetHistory === true || requestContext.resetContext === true

      // Server-side enforcement: only allow openEndedContext if the agent explicitly opts in
      if (openEndedContext) {
        const enabled = agent.openEndedContext?.enabled === true
        if (!enabled) {
          return response.badRequest({ error: 'This agent does not accept open-ended context' })
        }
        const max = agent.openEndedContext?.maxChars
        if (
          typeof max === 'number' &&
          Number.isFinite(max) &&
          max > 0 &&
          openEndedContext.length > max
        ) {
          return response.badRequest({
            error: `Open-ended context exceeds maxChars (${max})`,
          })
        }
      }

      // For global agents, we need to handle the case where they want to create content
      // For now, we'll execute the agent with a minimal context
      if (!agent.llmConfig) {
        return response.badRequest({ error: 'Agent missing configuration' })
      }

      // Fetch global history for context awareness (last 5 turns)
      const historyExecutions = resetHistory
        ? []
        : await agentExecutionService.getHistory(null, {
            agentId: agent.id,
            scope: 'global',
            limit: 5,
          })

      const history: Array<{ role: 'user' | 'assistant'; content: string }> = []
      for (const e of [...historyExecutions].reverse()) {
        if (e.request) {
          history.push({ role: 'user', content: e.request })
        }
        if (e.response?.rawResponse) {
          history.push({ role: 'assistant', content: e.response.rawResponse })
        }
      }

      // Build execution context for global agent
      const executionContext: AgentExecutionContext = {
        agent,
        scope: 'global',
        userId: (auth.use('web').user as any)?.id,
        data: {
          // Global agents don't have a post context yet
          // They might create one or work with general context
        },
        history,
      }

      // Create a minimal payload for global agents
      const payload = {
        context: {
          ...requestContext,
          openEndedContext,
        },
      }

      // Execute agent
      const result = await agentExecutor.execute(agent, executionContext, payload)

      if (!result.success) {
        const errorMessage = result.error?.message || 'Agent execution failed'
        console.error('Global agent execution failed:', {
          agentId,
          error: errorMessage,
          stack: result.error?.stack,
        })
        return response.badRequest({
          error: errorMessage,
          details: process.env.NODE_ENV === 'development' ? result.error?.stack : undefined,
        })
      }

      const rawResponse = (result as any).rawResponse
      const summary = (result as any).summary
      const determination = (result as any).determination
      const suggestions = result.data || {}

      // Extract generated mediaId from tool results (if image was generated)
      let generatedMediaId: string | undefined = undefined
      let generatedMediaUrl: string | undefined = undefined
      let generatedDarkUrl: string | undefined = undefined
      if (suggestions.toolResults && Array.isArray(suggestions.toolResults)) {
        const generateImageResult = suggestions.toolResults.find(
          (r: any) => r.tool === 'generate_image' || r.tool_name === 'generate_image'
        )
        if (generateImageResult && generateImageResult.success && generateImageResult.result?.mediaId) {
          generatedMediaId = generateImageResult.result.mediaId
          generatedMediaUrl = generateImageResult.result.url
          generatedDarkUrl = generateImageResult.result.darkUrl
        }
      }

      // For global agents, we might need to create a new post
      // For now, we'll return the response and let the frontend handle it
      // Save execution history for global agents
      try {
        const execution = await agentExecutionService.saveExecution({
          postId: null, // Global agents don't have a post ID
          agentId,
          viewMode: 'ai-review', // Global agents create in AI review mode
          userId: (auth.use('web').user as any)?.id ?? null,
          request: openEndedContext ?? null,
          response: {
            rawResponse,
            summary,
            determination,
            suggestions,
            generatedMediaId,
            generatedMediaUrl,
            generatedDarkUrl,
            executionMeta: (result as any).executionMeta,
            transcript: (result as any).transcript,
          },
          context: {
            ...requestContext,
            scope: 'global',
          },
          scope: 'global',
        })
        // Log to activity log
        await agentExecutionService.logToActivityLog(execution, auth)
      } catch (historyError: any) {
        // Don't fail the request if history saving fails, but log it
        console.error('Failed to save global agent execution history:', {
          agentId,
          error: historyError?.message,
        })
      }

      const responseData: any = {
        message: 'Agent executed successfully',
        summary: summary || 'Agent completed. Check the response for details.',
        determination,
        rawResponse,
        suggestions,
        generatedMediaId,
        generatedMediaUrl,
        generatedDarkUrl,
        executionMeta: (result as any).executionMeta,
        transcript: (result as any).transcript,
      }

      return response.ok(responseData)
    } catch (e: any) {
      console.error('Global agent execution error:', {
        agentId,
        error: e?.message,
        stack: e?.stack,
        name: e?.name,
      })
      return response.badRequest({
        error: e?.message || 'Failed to run global agent',
        details: process.env.NODE_ENV === 'development' ? e?.stack : undefined,
      })
    }
  }

  /**
   * POST /api/public/agents/:agentId/run
   * External trigger for agents (webhooks/API)
   * Requires X-Agent-Key or Authorization header matching MCP_AUTH_TOKEN or AGENT_TRIGGER_SECRET
   */
  async triggerExternal({ params, request, response, auth }: HttpContext) {
    const { agentId } = params
    const secret = env.get('AGENT_TRIGGER_SECRET') || env.get('MCP_AUTH_TOKEN')

    // 1. Authentication
    const providedSecret =
      request.header('X-Agent-Key') || request.header('Authorization')?.replace('Bearer ', '')

    if (secret && providedSecret !== secret) {
      return response.unauthorized({ error: 'Invalid trigger secret' })
    }

    if (!secret) {
      console.warn('[AgentsController.triggerExternal] No trigger secret configured. Endpoint is unprotected.')
    }

    // 2. Validate agent
    const agent = agentRegistry.get(agentId)
    if (!agent) return response.notFound({ error: 'Agent not found' })

    const payload = request.all()
    const { postId, context = {}, openEndedContext, scope = 'dropdown' } = payload

    // 3. Verify scope
    if (!agentRegistry.isAvailableInScope(agentId, scope as any)) {
      return response.forbidden({ error: `Agent not available for ${scope} scope` })
    }

    try {
      let result: any
      if (postId) {
        result = await this._runAgentForPost(postId, agent, auth, {
          scope: scope as any,
          context,
          openEndedContext,
          viewMode: context.viewMode || 'source',
        })
      } else {
        // Run as global agent
        // For external triggers without a post, we mimic the runGlobal behavior
        // but need to handle the execution manually since runGlobal is an endpoint itself
        
        const executionContext: AgentExecutionContext = {
          agent,
          scope: 'global',
          userId: undefined, // External trigger
          data: { ...context },
        }

        const runPayload = {
          context: {
            ...context,
            openEndedContext,
          },
        }

        const agentExecutor = (await import('#services/agent_executor')).default
        const runResult = await agentExecutor.execute(agent, executionContext, runPayload)

        if (!runResult.success) {
          throw runResult.error || new Error('Agent execution failed')
        }

        result = {
          success: true,
          agentId,
          response: runResult.data,
          summary: (runResult as any).summary,
        }
      }

      return response.ok(result)
    } catch (e: any) {
      console.error('External agent trigger error:', e)
      return response.badRequest({ error: e.message || 'Failed to trigger agent' })
    }
  }
}
