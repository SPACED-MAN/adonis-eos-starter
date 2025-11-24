import type { HttpContext } from '@adonisjs/core/http'
import agentService from '#services/agent_service'
import PostSerializerService from '#services/post_serializer_service'
import Post from '#models/post'
import authorizationService from '#services/authorization_service'
import RevisionService from '#services/revision_service'
import db from '@adonisjs/lucid/services/db'

export default class AgentsController {
  /**
   * GET /api/agents
   * List configured agents
   */
  async index({ response }: HttpContext) {
    const agents = agentService.parseAgents().map((a) => ({ id: a.id, name: a.name }))
    return response.ok({ data: agents })
  }

  /**
   * POST /api/posts/:id/agents/:agentId/run
   * Send current post (canonical JSON) to agent webhook and apply suggestions into review_draft
   * Body: { context?: any }
   */
  async runForPost({ params, request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as 'admin' | 'editor' | 'translator' | undefined
    // Editors and admins can run agents; translators cannot alter review drafts globally
    if (!(role === 'admin' || role === 'editor')) {
      return response.forbidden({ error: 'Not allowed to run agents' })
    }
    const { id, agentId } = params
    const agents = agentService.parseAgents()
    const agent = agents.find((a) => a.id === agentId)
    if (!agent) return response.notFound({ error: 'Agent not found' })
    try {
      const post = await Post.findOrFail(id)
      const canonical = await PostSerializerService.serialize(id)
      const payload = {
        post: canonical.post,
        modules: canonical.modules,
        context: request.input('context') || {},
      }
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (agent.secret) headers['Authorization'] = `Bearer ${agent.secret}`
      const res = await fetch(agent.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        return response.badRequest({ error: `Agent failed: ${res.status} ${txt}` })
      }
      const suggestions = await res.json().catch(() => ({}))
      const suggestedPost: any = (suggestions && suggestions.post) || {}
      // Apply to review_draft only: merge with existing review_draft, DO NOT change live fields here
      const current = await Post.findOrFail(id)
      const existingDraft: any = (current as any).reviewDraft || (current as any).review_draft || {}
      const merged = { ...(existingDraft || {}), ...(suggestedPost || {}) }
      await db.from('posts').where('id', id).update({ review_draft: merged, updated_at: new Date() } as any)
      await RevisionService.record({
        postId: id,
        mode: 'review',
        snapshot: merged,
        userId: (auth.use('web').user as any)?.id,
      })
      return response.ok({ message: 'Suggestions saved to review draft', applied: Object.keys(suggestedPost || {}) })
    } catch (e: any) {
      return response.badRequest({ error: e?.message || 'Failed to run agent' })
    }
  }
}


