import type { HttpContext } from '@adonisjs/core/http'
import agentRegistry from '#services/agent_registry'
import PostSerializerService from '#services/post_serializer_service'
import Post from '#models/post'
import roleRegistry from '#services/role_registry'
import RevisionService from '#services/revision_service'
import db from '@adonisjs/lucid/services/db'
import AgentPostPayloadDto from '#dtos/agent_post_payload_dto'
import internalAgentExecutor from '#services/internal_agent_executor'
import type { AgentExecutionContext } from '#types/agent_types'

export default class AgentsController {
  /**
   * GET /api/agents
   * List configured agents available in the dropdown scope
   */
  async index({ response }: HttpContext) {
    const agents = agentRegistry
      .listByScope('dropdown')
      .map((a) => ({
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
      }))
    return response.ok({ data: agents })
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

    // Check if agent is available in dropdown scope
    if (!agentRegistry.isAvailableInScope(agentId, 'dropdown')) {
      return response.forbidden({ error: 'Agent not available for manual execution' })
    }

    try {
      await Post.findOrFail(id)
      // Get view mode from context (defaults to 'source' for backward compatibility)
      const ctx = (request.input('context') as Record<string, unknown> | undefined) || {}
      const viewMode = (ctx.viewMode as 'source' | 'review' | 'ai-review') || 'source'
      const canonical = await PostSerializerService.serialize(id, viewMode)
      const openEnded = request.input('openEndedContext')
      const openEndedContext =
        typeof openEnded === 'string' && openEnded.trim() ? openEnded.trim() : undefined

      // Server-side enforcement: only allow openEndedContext if the agent explicitly opts in
      if (openEndedContext) {
        const enabled = agent.openEndedContext?.enabled === true
        if (!enabled) {
          return response.badRequest({ error: 'This agent does not accept open-ended context' })
        }
        const max = agent.openEndedContext?.maxChars
        if (typeof max === 'number' && Number.isFinite(max) && max > 0 && openEndedContext.length > max) {
          return response.badRequest({
            error: `Open-ended context exceeds maxChars (${max})`,
          })
        }
      }

      const payload = new AgentPostPayloadDto(canonical, {
        ...ctx,
        ...(openEndedContext ? { openEndedContext } : {}),
      })

      let suggestions: any = {}

      // Execute based on agent type
      if (agent.type === 'external') {
        if (!agent.external) {
          return response.badRequest({ error: 'External agent missing configuration' })
        }

        const webhookUrl = agentRegistry.getWebhookUrl(agentId)
        if (!webhookUrl) {
          return response.badRequest({ error: 'Agent webhook URL not configured' })
        }

        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (agent.external.secret) {
          if (agent.external.secretHeader) {
            headers[agent.external.secretHeader] = agent.external.secret
          } else {
            headers['Authorization'] = `Bearer ${agent.external.secret}`
          }
        }

        const timeout = agentRegistry.getTimeout(agentId)
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)

        try {
          const res = await fetch(webhookUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: controller.signal,
          })
          clearTimeout(timeoutId)

          if (!res.ok) {
            const txt = await res.text().catch(() => '')
            return response.badRequest({ error: `Agent failed: ${res.status} ${txt}` })
          }

          suggestions = await res.json().catch(() => ({}))
        } catch (error: any) {
          clearTimeout(timeoutId)
          if (error.name === 'AbortError') {
            return response.requestTimeout({ error: 'Agent request timed out' })
          }
          throw error
        }
      } else if (agent.type === 'internal') {
        if (!agent.internal) {
          return response.badRequest({ error: 'Internal agent missing configuration' })
        }

        // Build execution context
        const executionContext: AgentExecutionContext = {
          agent,
          scope: 'dropdown',
          userId: (auth.use('web').user as any)?.id,
          data: {
            postId: id,
            post: canonical,
          },
        }

        // Execute internal agent
        const result = await internalAgentExecutor.execute(agent, executionContext, payload)

        if (!result.success) {
          const errorMessage = result.error?.message || 'Internal agent execution failed'
          console.error('Internal agent execution failed:', {
            agentId,
            error: errorMessage,
            stack: result.error?.stack,
          })
          return response.badRequest({
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? result.error?.stack : undefined,
          })
        }

        // Extract suggestions from result
        // Internal agents can return suggestions in the same format as external agents
        suggestions = result.data || {}

        // Store raw response and summary for later use (before we enter nested blocks)
        const rawResponse = (result as any).rawResponse
        const summary = (result as any).summary

        // Log what we're extracting for debugging
        console.log('Internal agent result:', {
          agentId,
          hasData: !!result.data,
          hasPost: !!(result.data && result.data.post),
          hasModules: !!(result.data && Array.isArray(result.data.modules)),
          modulesCount: result.data?.modules?.length || 0,
          dataKeys: result.data ? Object.keys(result.data) : [],
          postKeys: result.data?.post ? Object.keys(result.data.post) : [],
          rawResponse: rawResponse?.substring(0, 200),
          hasSummary: !!summary,
        })

        // Get current post and extract suggested post
        const current = await Post.findOrFail(id)
        const suggestedPost: any = (suggestions && suggestions.post) || {}
        const suggestedModules: any[] = Array.isArray(suggestions?.modules) ? suggestions.modules : []

        // Log what we're applying
        console.log('Applying suggestions:', {
          agentId,
          suggestedPostKeys: Object.keys(suggestedPost),
          suggestedPost,
          suggestedModulesCount: suggestedModules.length,
        })

        // For internal agents, apply to ai_review_draft (not review_draft)
        // This follows the AI Review → Review → Approve workflow
        // Internal agents write to ai_review_draft
        const existingAiDraft: any = current.aiReviewDraft || {}
        const baseDraft = current.reviewDraft || {
          slug: current.slug,
          title: current.title,
          status: current.status,
          excerpt: current.excerpt ?? null,
          metaTitle: current.metaTitle ?? null,
          metaDescription: current.metaDescription ?? null,
        }

        // Merge: base (review_draft if exists, else approved) + existing ai_review_draft + new suggestions
        const merged = { ...baseDraft, ...existingAiDraft, ...(suggestedPost || {}) }

        console.log('Merged draft to save:', {
          agentId,
          mergedKeys: Object.keys(merged),
          merged,
        })

        try {
          // Use Post.query() to match other code patterns
          // Note: Use snake_case column names for direct updates
          await Post.query()
            .where('id', id)
            .update({ ai_review_draft: merged, updated_at: new Date() } as any)

          // Apply module changes to ai_review_props
          if (suggestedModules.length > 0) {
            // Get all post modules for this post with both base props and ai_review_props
            const postModules = await db
              .from('post_modules')
              .join('module_instances', 'post_modules.module_id', 'module_instances.id')
              .where('post_modules.post_id', id)
              .select(
                'post_modules.id as postModuleId',
                'post_modules.order_index as orderIndex',
                'module_instances.id as moduleInstanceId',
                'module_instances.type as moduleType',
                'module_instances.props as baseProps',
                'module_instances.ai_review_props as existingAiReviewProps'
              )
              .orderBy('post_modules.order_index', 'asc')

            // Deep merge helper function
            const deepMerge = (base: Record<string, any>, override: Record<string, any>): Record<string, any> => {
              const result = { ...base }
              for (const key in override) {
                const overrideVal = override[key]
                const baseVal = base[key]
                if (
                  overrideVal &&
                  typeof overrideVal === 'object' &&
                  !Array.isArray(overrideVal) &&
                  baseVal &&
                  typeof baseVal === 'object' &&
                  !Array.isArray(baseVal)
                ) {
                  // Deep merge nested objects
                  result[key] = deepMerge(baseVal, overrideVal)
                } else {
                  // Replace primitives and arrays
                  result[key] = overrideVal
                }
              }
              return result
            }

            for (const suggestedModule of suggestedModules) {
              // Find matching modules by type and optionally orderIndex
              // If orderIndex is specified, match only that one; otherwise match ALL modules of that type
              const matchingModules = postModules.filter((pm: any) => {
                if (pm.moduleType !== suggestedModule.type) return false
                if (suggestedModule.orderIndex !== undefined) {
                  return pm.orderIndex === suggestedModule.orderIndex
                }
                return true
              })

              if (matchingModules.length === 0) {
                console.warn(`Module not found: type=${suggestedModule.type}, orderIndex=${suggestedModule.orderIndex}`)
                continue
              }

              // Update ALL matching modules (not just the first)
              // This allows the AI to update all modules of a type when orderIndex is not specified
              for (const targetModule of matchingModules) {
                // Get base props (the approved/live props)
                // Handle both JSON string and object formats
                let baseProps: Record<string, any> = {}
                if (targetModule.baseProps) {
                  if (typeof targetModule.baseProps === 'string') {
                    try {
                      baseProps = JSON.parse(targetModule.baseProps)
                    } catch {
                      baseProps = {}
                    }
                  } else {
                    baseProps = targetModule.baseProps as Record<string, any>
                  }
                }

                // Get existing ai_review_props (overrides on top of base)
                // Handle both JSON string and object formats
                let existingAiReviewProps: Record<string, any> = {}
                if (targetModule.existingAiReviewProps) {
                  if (typeof targetModule.existingAiReviewProps === 'string') {
                    try {
                      existingAiReviewProps = JSON.parse(targetModule.existingAiReviewProps)
                    } catch {
                      existingAiReviewProps = {}
                    }
                  } else {
                    existingAiReviewProps = targetModule.existingAiReviewProps as Record<string, any>
                  }
                }

                // Get current effective props (base + existing ai_review) - this is what the user sees in ai-review mode
                const currentEffectiveProps = deepMerge(baseProps, existingAiReviewProps)

                // Merge current effective props with new suggested props
                // This ensures we preserve all existing props and only update what's changed
                const mergedAiReviewProps = deepMerge(currentEffectiveProps, suggestedModule.props || {})

                console.log(`Updating module ${targetModule.postModuleId} (${suggestedModule.type}, orderIndex: ${targetModule.orderIndex}):`, {
                  basePropsKeys: Object.keys(baseProps),
                  existingAiReviewPropsKeys: Object.keys(existingAiReviewProps),
                  currentEffectivePropsKeys: Object.keys(currentEffectiveProps),
                  newProps: Object.keys(suggestedModule.props || {}),
                  mergedAiReviewPropsKeys: Object.keys(mergedAiReviewProps),
                })

                // Update module instance ai_review_props directly by module instance ID
                await db
                  .from('module_instances')
                  .where('id', targetModule.moduleInstanceId)
                  .update({ ai_review_props: mergedAiReviewProps, updated_at: new Date() } as any)
              }
            }
          }

          await RevisionService.record({
            postId: id,
            mode: 'ai-review',
            snapshot: merged,
            userId: (auth.use('web').user as any)?.id,
          })
        } catch (dbError: any) {
          console.error('Database update failed:', {
            agentId,
            error: dbError?.message,
            stack: dbError?.stack,
            merged,
            errorName: dbError?.name,
            errorCode: dbError?.code,
          })
          throw dbError
        }

        // Build applied changes list
        const applied: string[] = []
        if (suggestedPost && Object.keys(suggestedPost).length > 0) {
          applied.push(...Object.keys(suggestedPost).map(key => `post.${key}`))
        }
        if (suggestedModules.length > 0) {
          applied.push(...suggestedModules.map((m: any) => `module.${m.type}${m.orderIndex !== undefined ? `[${m.orderIndex}]` : ''}`))
        }

        // For internal agents, include the raw AI response for preview
        const responseData: any = {
          message: 'Suggestions saved to AI review draft',
          applied,
        }

        // Include raw response and summary if available (for UI preview)
        if (rawResponse) {
          responseData.rawResponse = rawResponse
        }
        if (summary) {
          responseData.summary = summary
        }

        return response.ok(responseData)
      } else {
        // External agents - extract suggestions
        const current = await Post.findOrFail(id)
        const suggestedPost: any = (suggestions && suggestions.post) || {}
        // External agents write to review_draft (existing behavior)
        const existingDraft: any = current.reviewDraft || {}
        const merged = { ...(existingDraft || {}), ...(suggestedPost || {}) }
        await db
          .from('posts')
          .where('id', id)
          .update({ review_draft: merged, updated_at: new Date() } as any)
        await RevisionService.record({
          postId: id,
          mode: 'review',
          snapshot: merged,
          userId: (auth.use('web').user as any)?.id,
        })
        return response.ok({
          message: 'Suggestions saved to review draft',
          applied: Object.keys(suggestedPost || {}),
        })
      }
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
}
