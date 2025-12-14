import type { HttpContext } from '@adonisjs/core/http'
import agentRegistry from '#services/agent_registry'
import PostSerializerService from '#services/post_serializer_service'
import Post from '#models/post'
import roleRegistry from '#services/role_registry'
import RevisionService from '#services/revision_service'
import db from '@adonisjs/lucid/services/db'
import AgentPostPayloadDto from '#dtos/agent_post_payload_dto'

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
      const canonical = await PostSerializerService.serialize(id)
      const ctx = (request.input('context') as Record<string, unknown> | undefined) || {}
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
        // Internal agents not yet implemented
        return response.badRequest({
          error: 'Internal agents are not yet implemented',
        })
      }

      const suggestedPost: any = (suggestions && suggestions.post) || {}
      // Apply to review_draft only: merge with existing review_draft, DO NOT change live fields here
      const current = await Post.findOrFail(id)
      const existingDraft: any = (current as any).reviewDraft || (current as any).review_draft || {}
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
    } catch (e: any) {
      return response.badRequest({ error: e?.message || 'Failed to run agent' })
    }
  }
}
