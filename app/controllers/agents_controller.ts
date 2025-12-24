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
import moduleRegistry from '#services/module_registry'
import agentExecutionService from '#services/agent_execution_service'
import { markdownToLexical } from '#helpers/markdown_to_lexical'

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
   * List configured agents available in a specific scope
   * Query params: ?scope=dropdown|global|field
   */
  async index({ request, response }: HttpContext) {
    const scope =
      (request.input('scope') as 'dropdown' | 'global' | 'field' | undefined) || 'dropdown'
    const fieldType = request.input('fieldType') as string | undefined
    const fieldKey = request.input('fieldKey') as string | undefined

    const agents = agentRegistry.listByScope(scope, undefined, fieldKey, fieldType).map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      type: a.type || 'internal',
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
        .filter((s) => s.enabled !== false)
        .map((s) => ({
          scope: s.scope,
          order: s.order,
          enabled: s.enabled,
          fieldTypes: (s as any).fieldTypes,
          fieldKeys: (s as any).fieldKeys,
        })),
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

    // Extract scope from request context
    const requestContext = request.input('context') || {}
    const scope =
      (requestContext.scope as 'dropdown' | 'global' | 'field' | undefined) || 'dropdown'
    const fieldKey = requestContext.fieldKey as string | undefined
    const fieldType = requestContext.fieldType as string | undefined

    // Check if agent is available in the requested scope
    const availableAgents = agentRegistry.listByScope(scope, undefined, fieldKey, fieldType)
    if (!availableAgents.some((a) => a.id === agentId)) {
      return response.forbidden({ error: `Agent not available for ${scope} scope` })
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

      const payload = new AgentPostPayloadDto(canonical, {
        ...ctx,
        ...(openEndedContext ? { openEndedContext } : {}),
      })

      let suggestions: any = {}

      // Agents are now internal-only (AI-powered)
      // For webhook-based automation, use Workflows
      if (agent.type !== 'internal') {
        return response.badRequest({
          error:
            'Only internal (AI-powered) agents are supported. For webhook-based automation, use Workflows.',
        })
      }

      if (agent.type === 'internal') {
        if (!agent.internal) {
          return response.badRequest({ error: 'Internal agent missing configuration' })
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
        const lastCreatedPostId = (result as any).lastCreatedPostId

        // Extract generated mediaId from tool results (if image was generated)
        let generatedMediaId: string | undefined = undefined
        let imageGenerationFailed = false
        if (suggestions.toolResults && Array.isArray(suggestions.toolResults)) {
          const generateImageResult = suggestions.toolResults.find(
            (r: any) => r.tool === 'generate_image' || r.tool_name === 'generate_image'
          )
          if (generateImageResult) {
            if (generateImageResult.success && generateImageResult.result?.mediaId) {
              generatedMediaId = generateImageResult.result.mediaId
            } else {
              // Image generation failed - mark it so we can clean up placeholders
              imageGenerationFailed = true
            }
          }
        }


        // Get current post and extract suggested post
        const current = await Post.findOrFail(id)
        const suggestedPost: any = (suggestions && suggestions.post) || {}
        const suggestedModules: any[] = Array.isArray(suggestions?.modules)
          ? suggestions.modules
          : []

        // For field-scoped agents, automatically place generated media in the target field
        if (scope === 'field' && fieldKey && generatedMediaId) {
          // Handle post-level fields (e.g., post.featuredImageId)
          if (fieldKey === 'post.featuredImageId') {
            suggestedPost.featuredImageId = generatedMediaId
          }
          // Handle module-level fields (e.g., module.hero-with-media.image)
          else if (fieldKey.startsWith('module.')) {
            const fieldKeyParts = fieldKey.split('.')
            if (fieldKeyParts.length >= 3) {
              const moduleType = fieldKeyParts[1]
              const fieldName = fieldKeyParts.slice(2).join('.') // Handle nested fields like "image.id"

              // Get moduleInstanceId from context if available
              const contextModuleInstanceId = (requestContext as any).moduleInstanceId

              // Find or create module update entry
              let moduleUpdate = suggestedModules.find((m: any) => {
                if (m.type !== moduleType) return false
                if (contextModuleInstanceId && m.moduleInstanceId !== contextModuleInstanceId)
                  return false
                return true
              })

              if (!moduleUpdate) {
                // Create new module update entry
                moduleUpdate = {
                  type: moduleType,
                  props: {},
                }
                if (contextModuleInstanceId) {
                  moduleUpdate.moduleInstanceId = contextModuleInstanceId
                }
                suggestedModules.push(moduleUpdate)
              }

              // Set the field value (handle nested paths like "image.id")
              const fieldParts = fieldName.split('.')
              let currentProps: any = moduleUpdate.props
              for (let i = 0; i < fieldParts.length - 1; i++) {
                if (!currentProps[fieldParts[i]]) {
                  currentProps[fieldParts[i]] = {}
                }
                currentProps = currentProps[fieldParts[i]]
              }
              currentProps[fieldParts[fieldParts.length - 1]] = generatedMediaId

              // Also set alt text and description if available from tool result
              const generateImageResult = suggestions.toolResults?.find(
                (r: any) =>
                  (r.tool === 'generate_image' || r.tool_name === 'generate_image') && r.success
              )
              if (generateImageResult?.result?.altText) {
                const altField = fieldName.replace(/\.id$/, '.alt').replace(/\.id$/, '')
                const altParts = altField.split('.')
                let altCurrent: any = moduleUpdate.props
                for (let i = 0; i < altParts.length - 1; i++) {
                  if (!altCurrent[altParts[i]]) {
                    altCurrent[altParts[i]] = {}
                  }
                  altCurrent = altCurrent[altParts[i]]
                }
                altCurrent[altParts[altParts.length - 1]] = generateImageResult.result.altText
              }

              if (generateImageResult?.result?.description) {
                const descField = fieldName.replace(/\.id$/, '.description').replace(/\.id$/, '')
                const descParts = descField.split('.')
                let descCurrent: any = moduleUpdate.props
                for (let i = 0; i < descParts.length - 1; i++) {
                  if (!descCurrent[descParts[i]]) {
                    descCurrent[descParts[i]] = {}
                  }
                  descCurrent = descCurrent[descParts[i]]
                }
                descCurrent[descParts[descParts.length - 1]] =
                  generateImageResult.result.description
              }

            }
          }
        }

        // Replace any placeholder strings with actual mediaId if we have one, or remove them if generation failed
        if (generatedMediaId || imageGenerationFailed) {
          const replacePlaceholders = (obj: any): any => {
            if (typeof obj === 'string') {
              // Replace common placeholder patterns (case-insensitive, flexible matching)
              const placeholderPatterns = [
                /mediaId\s+from\s+generate_image\s+result/i,
                /<mediaId\s+from\s+generate_image\s+result>/i,
                /GENERATED_IMAGE_ID/i,
                /<GENERATED_IMAGE_ID>/i,
                /CALL_TOOL_generate_image_\d+\.mediaId/i,
                /\{\{tool_code\.generate_image_\d+\}\}/i, // {{tool_code.generate_image_0}}
                /\{\{tool\.generate_image\.\d+\.mediaId\}\}/i, // {{tool.generate_image.0.mediaId}}
                // Also check for exact string matches
                'mediaId from generate_image result',
                '<mediaId from generate_image result>',
              ]
              for (const pattern of placeholderPatterns) {
                if (
                  typeof pattern === 'string' &&
                  obj.toLowerCase().includes(pattern.toLowerCase())
                ) {
                  if (imageGenerationFailed) {
                    return null // Remove the field if generation failed
                  } else {
                    return generatedMediaId
                  }
                } else if (pattern instanceof RegExp && pattern.test(obj)) {
                  if (imageGenerationFailed) {
                    return null // Remove the field if generation failed
                  } else {
                    return generatedMediaId
                  }
                }
              }
              return obj
            } else if (Array.isArray(obj)) {
              return obj.map(replacePlaceholders).filter((item) => item !== null)
            } else if (obj && typeof obj === 'object') {
              const replacedObj: any = {}
              for (const key in obj) {
                const replaced = replacePlaceholders(obj[key])
                // Only include the key if the value is not null (when generation failed)
                if (replaced !== null) {
                  replacedObj[key] = replaced
                }
              }
              return replacedObj
            }
            return obj
          }

          // Replace placeholders in suggestedPost and suggestedModules
          const beforePost = JSON.stringify(suggestedPost)
          Object.keys(suggestedPost).forEach((key) => {
            const replaced = replacePlaceholders(suggestedPost[key])
            if (replaced === null) {
              // Remove the field if generation failed
              delete suggestedPost[key]
            } else {
              suggestedPost[key] = replaced
            }
          })
          const afterPost = JSON.stringify(suggestedPost)
          if (beforePost !== afterPost) {
          }

          suggestedModules.forEach((module, index) => {
            const before = JSON.stringify(module)
            suggestedModules[index] = replacePlaceholders(module)
            const after = JSON.stringify(suggestedModules[index])
            if (before !== after) {
            }
          })
        } else {
        }


        // Determine if we should redirect (e.g. for new translations)
        let redirectPostId = suggestions.redirectPostId
        if (!redirectPostId && lastCreatedPostId && lastCreatedPostId !== id) {
          redirectPostId = lastCreatedPostId
        }

        // Safety check: if we are redirecting to a DIFFERENT post, we should
        // strictly ignore any "post" or "modules" keys returned in the final JSON.
        // These are almost certainly accidental side-effects of the LLM's context
        // and would overwrite the source language (e.g. EN) with translated copy.
        const isRedirecting = !!(redirectPostId && redirectPostId !== id)
        const finalSuggestedPost = isRedirecting ? {} : (suggestions.post || {})
        const finalSuggestedModules = isRedirecting ? [] : (Array.isArray(suggestions?.modules) ? suggestions.modules : [])

        // For field-scoped agents, respect the active view mode
        // For other scopes, use the default AI Review workflow
        const isFieldScope = scope === 'field'
        const targetViewMode = isFieldScope ? viewMode : 'ai-review'

        // Build the base depending on target view mode
        let base: any
        let existingDraft: any
        let updateColumn: string
        let revisionMode: 'source' | 'review' | 'ai-review'

        if (targetViewMode === 'source') {
          // Source mode: write directly to approved fields (or review_draft if it exists)
          base = current.reviewDraft || {
            slug: current.slug,
            title: current.title,
            status: current.status,
            excerpt: current.excerpt ?? null,
            metaTitle: current.metaTitle ?? null,
            metaDescription: current.metaDescription ?? null,
            canonicalUrl: current.canonicalUrl ?? null,
            robotsJson: current.robotsJson ?? null,
            jsonldOverrides: current.jsonldOverrides ?? null,
            featuredImageId: current.featuredImageId ?? null,
          }
          existingDraft = {}
          updateColumn = current.reviewDraft ? 'review_draft' : 'approved' // Will update review_draft if exists, otherwise approved fields
          revisionMode = 'review'
        } else if (targetViewMode === 'review') {
          // Review mode: write to review_draft
          base = {
            slug: current.slug,
            title: current.title,
            status: current.status,
            excerpt: current.excerpt ?? null,
            metaTitle: current.metaTitle ?? null,
            metaDescription: current.metaDescription ?? null,
            canonicalUrl: current.canonicalUrl ?? null,
            robotsJson: current.robotsJson ?? null,
            jsonldOverrides: current.jsonldOverrides ?? null,
            featuredImageId: current.featuredImageId ?? null,
          }
          existingDraft = current.reviewDraft || {}
          updateColumn = 'review_draft'
          revisionMode = 'review'
        } else {
          // AI Review mode (default for non-field scopes): write to ai_review_draft
          base = current.reviewDraft || {
            slug: current.slug,
            title: current.title,
            status: current.status,
            excerpt: current.excerpt ?? null,
            metaTitle: current.metaTitle ?? null,
            metaDescription: current.metaDescription ?? null,
            canonicalUrl: current.canonicalUrl ?? null,
            robotsJson: current.robotsJson ?? null,
            jsonldOverrides: current.jsonldOverrides ?? null,
            featuredImageId: current.featuredImageId ?? null,
          }
          existingDraft = current.aiReviewDraft || {}
          updateColumn = 'ai_review_draft'
          revisionMode = 'ai-review'
        }

        // Merge: base + existing draft + new suggestions
        const merged = { ...base, ...existingDraft, ...finalSuggestedPost }

        // Build applied changes list
        const applied: string[] = []
        if (finalSuggestedPost && Object.keys(finalSuggestedPost).length > 0) {
          applied.push(...Object.keys(finalSuggestedPost).map((key) => `post.${key}`))
        }
        if (finalSuggestedModules.length > 0) {
          applied.push(
            ...finalSuggestedModules.map((m: any) => {
              // Get module label from registry
              let moduleLabel = m.type
              try {
                if (moduleRegistry.has(m.type)) {
                  const schema = moduleRegistry.getSchema(m.type)
                  moduleLabel = schema.name
                }
              } catch {
                // Fallback to type if registry lookup fails
              }
              const suffix = m.orderIndex !== undefined ? ` [${m.orderIndex}]` : ''
              return `${moduleLabel}${suffix}`
            })
          )
        }

        // Only update if there are actual suggestions for the current post
        if (applied.length > 0) {
          try {
            // Use Post.query() to match other code patterns
            // Note: Use snake_case column names for direct updates
            if (updateColumn === 'approved') {
              // For source mode without review_draft, update approved fields directly
              await Post.query()
                .where('id', id)
                .update({
                  slug: merged.slug,
                  title: merged.title,
                  excerpt: merged.excerpt,
                  meta_title: merged.metaTitle,
                  meta_description: merged.metaDescription,
                  canonical_url: merged.canonicalUrl,
                  robots_json: merged.robotsJson,
                  jsonld_overrides: merged.jsonldOverrides,
                  featured_image_id: merged.featuredImageId,
                  updated_at: new Date(),
                } as any)
            } else {
              // For review_draft or ai_review_draft, update the JSONB column
              await Post.query()
                .where('id', id)
                .update({ [updateColumn]: merged, updated_at: new Date() } as any)
            }

            // Apply module changes based on target view mode
            if (finalSuggestedModules.length > 0) {
              // Determine which props column to update based on view mode
              const modulePropsColumn =
                targetViewMode === 'source'
                  ? 'props' // Source mode: update approved props directly
                  : targetViewMode === 'review'
                    ? 'review_props' // Review mode: update review_props
                    : 'ai_review_props' // AI Review mode: update ai_review_props

              // Get all post modules for this post with props based on view mode
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
                  'module_instances.review_props as existingReviewProps',
                  'module_instances.ai_review_props as existingAiReviewProps'
                )
                .orderBy('post_modules.order_index', 'asc')

              // For field-scoped agents, automatically inject orderIndex and type if missing
              // This helps when the AI doesn't know the exact module context
              if (scope === 'field' && fieldKey && fieldKey.startsWith('module.')) {
                // Parse module type from fieldKey (format: "module.{type}.{fieldName}")
                const fieldKeyParts = fieldKey.split('.')
                if (fieldKeyParts.length >= 2) {
                  const moduleTypeFromFieldKey = fieldKeyParts[1]

                  // Find the module instance that contains this field
                  // We'll match by module type and check if the field exists in the props
                  const targetModule = postModules.find((pm: any) => {
                    if (pm.moduleType !== moduleTypeFromFieldKey) return false

                    // If we have moduleInstanceId in context, use it for exact match
                    const contextModuleInstanceId = (ctx as any).moduleInstanceId
                    if (contextModuleInstanceId && pm.moduleInstanceId === contextModuleInstanceId) {
                      return true
                    }

                    // Otherwise, just match by type (will use first match)
                    return true
                  })

                  if (targetModule) {
                    // Auto-inject orderIndex and type for any module updates that are missing them
                    for (const suggestedModule of finalSuggestedModules) {
                      if (!suggestedModule.type || suggestedModule.type === moduleTypeFromFieldKey) {
                        suggestedModule.type = targetModule.moduleType
                      }
                      if (suggestedModule.orderIndex === undefined) {
                        suggestedModule.orderIndex = targetModule.orderIndex
                      }
                    }
                  }
                }
              }

              // Deep merge helper function
              const deepMerge = (
                baseObj: Record<string, any>,
                overrideObj: Record<string, any>
              ): Record<string, any> => {
                const mergedResult = { ...baseObj }
                for (const key in overrideObj) {
                  const overrideVal = overrideObj[key]
                  const baseVal = baseObj[key]
                  if (
                    overrideVal &&
                    typeof overrideVal === 'object' &&
                    !Array.isArray(overrideVal) &&
                    baseVal &&
                    typeof baseVal === 'object' &&
                    !Array.isArray(baseVal)
                  ) {
                    // Deep merge nested objects
                    mergedResult[key] = deepMerge(baseVal, overrideVal)
                  } else {
                    // Replace primitives and arrays
                    mergedResult[key] = overrideVal
                  }
                }
                return mergedResult
              }

              for (const suggestedModule of finalSuggestedModules) {
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
                  console.warn(
                    `Module not found: type=${suggestedModule.type}, orderIndex=${suggestedModule.orderIndex}`
                  )
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

                  // Get existing draft props based on view mode
                  // Handle both JSON string and object formats
                  let existingDraftProps: Record<string, any> = {}
                  if (targetViewMode === 'source') {
                    // Source mode: no draft props, update base props directly
                    existingDraftProps = {}
                  } else if (targetViewMode === 'review') {
                    // Review mode: get existing review_props
                    if (targetModule.existingReviewProps) {
                      if (typeof targetModule.existingReviewProps === 'string') {
                        try {
                          existingDraftProps = JSON.parse(targetModule.existingReviewProps)
                        } catch {
                          existingDraftProps = {}
                        }
                      } else {
                        existingDraftProps = targetModule.existingReviewProps as Record<string, any>
                      }
                    }
                  } else {
                    // AI Review mode: get existing ai_review_props
                    if (targetModule.existingAiReviewProps) {
                      if (typeof targetModule.existingAiReviewProps === 'string') {
                        try {
                          existingDraftProps = JSON.parse(targetModule.existingAiReviewProps)
                        } catch {
                          existingDraftProps = {}
                        }
                      } else {
                        existingDraftProps = targetModule.existingAiReviewProps as Record<string, any>
                      }
                    }
                  }

                  // Merge current effective props with new suggested props
                  // This ensures we preserve all existing props and only update what's changed
                  const propsToApply = { ...(suggestedModule.props || {}) }

                  // Automatic Markdown-to-Lexical conversion for RichText fields
                  if (moduleRegistry.has(targetModule.moduleType)) {
                    const schema = moduleRegistry.getSchema(targetModule.moduleType)
                    const richTextFields = schema.fieldSchema
                      .filter((f: any) => f.type === 'richtext')
                      .map((f: any) => f.slug)

                    const mediaFieldsWithIdStorage = schema.fieldSchema
                      .filter((f: any) => f.type === 'media' && f.config?.storeAs === 'id')
                      .map((f: any) => f.slug)

                    for (const key of Object.keys(propsToApply)) {
                      // RichText handling
                      if (richTextFields.includes(key)) {
                        const val = propsToApply[key]
                        if (typeof val === 'string' && val.trim() !== '') {
                          const trimmed = val.trim()
                          const looksJson = trimmed.startsWith('{') || trimmed.startsWith('[')
                          if (!looksJson) {
                            propsToApply[key] = markdownToLexical(val, { skipFirstH1: false })
                          }
                        }
                      }

                      // Media ID flattening: if agent provides { id: "uuid" } but field wants string
                      if (mediaFieldsWithIdStorage.includes(key)) {
                        const val = propsToApply[key]
                        if (val && typeof val === 'object' && val.id) {
                          propsToApply[key] = String(val.id)
                        }
                      }
                    }
                  }

                  const mergedDraftProps = deepMerge(currentEffectiveProps, propsToApply)

                  // Update module instance props based on view mode
                  if (targetViewMode === 'source') {
                    // Source mode: update base props directly
                    await db
                      .from('module_instances')
                      .where('id', targetModule.moduleInstanceId)
                      .update({ props: mergedDraftProps, updated_at: new Date() } as any)
                  } else {
                    // Review or AI Review mode: update the appropriate draft column
                    await db
                      .from('module_instances')
                      .where('id', targetModule.moduleInstanceId)
                      .update({
                        [modulePropsColumn]: mergedDraftProps,
                        updated_at: new Date(),
                      } as any)
                  }
                }
              }
            }

            await RevisionService.record({
              postId: id,
              mode: revisionMode,
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
        }

        // For internal agents, include the raw AI response for preview
        const responseData: any = {
          message: applied.length > 0 ? 'Suggestions saved to AI review draft' : (isRedirecting ? 'Translation complete. View the new post to see changes.' : 'Agent completed successfully'),
          applied,
          suggestions,
        }

        // Include redirect post ID if one was determined
        if (isRedirecting) {
          responseData.redirectPostId = redirectPostId
        }

        // Include raw response and summary if available (for UI preview)
        if (rawResponse) {
          responseData.rawResponse = rawResponse
        }
        if (summary) {
          responseData.summary = summary
        }
        // Include generated mediaId if an image was generated (for opening media picker)
        if (generatedMediaId) {
          responseData.generatedMediaId = generatedMediaId
        }

        // Save execution history
        try {
          const execution = await agentExecutionService.saveExecution({
            postId: id,
            agentId,
            viewMode,
            userId: (auth.use('web').user as any)?.id ?? null,
            request: openEndedContext ?? null,
            response: {
              rawResponse,
              summary,
              applied,
            },
            context: ctx,
            scope: scope || 'dropdown',
          })
          // Log to activity log
          await agentExecutionService.logToActivityLog(execution, auth)
        } catch (historyError: any) {
          // Don't fail the request if history saving fails, but log it
          console.error('Failed to save agent execution history:', {
            agentId,
            postId: id,
            error: historyError?.message,
          })
        }

        return response.ok(responseData)
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
      if (agent.type === 'internal') {
        if (!agent.internal) {
          return response.badRequest({ error: 'Internal agent missing configuration' })
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
        }

        // Create a minimal payload for global agents
        const payload = {
          context: {
            ...requestContext,
            openEndedContext,
          },
        }

        // Execute internal agent
        const result = await internalAgentExecutor.execute(agent, executionContext, payload)

        if (!result.success) {
          const errorMessage = result.error?.message || 'Internal agent execution failed'
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
        const suggestions = result.data || {}

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
              suggestions,
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
          rawResponse,
          suggestions,
        }

        return response.ok(responseData)
      } else {
        // Only internal agents are supported
        return response.badRequest({
          error:
            'Only internal (AI-powered) agents are supported. For webhook-based automation, use Workflows.',
        })
      }
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
}
