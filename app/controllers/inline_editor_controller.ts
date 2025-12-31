import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import roleRegistry from '#services/role_registry'
import moduleRegistry from '#services/module_registry'
import { coerceJsonObject } from '../helpers/jsonb.js'

type TargetScope = 'props' | 'overrides'

function setAtPath(obj: any, path: string, value: any) {
  const parts = path.split(/[.[\]]/).filter(Boolean)
  if (parts.length === 0) return
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!
    const nextKey = parts[i + 1]!
    if (cur[key] === undefined || cur[key] === null || typeof cur[key] !== 'object') {
      cur[key] = /^\d+$/.test(nextKey) ? [] : {}
    }
    cur = cur[key]
  }
  cur[parts[parts.length - 1]!] = value
}

export default class InlineEditorController {
  /**
   * PATCH /api/posts/:postId/inline/modules/:moduleId
   * Update a single field of a module for inline editing.
   * Body: { path: string; value: any; scope?: 'props'|'overrides'; mode?: 'source'|'review'|'ai-review' }
   */
  async updateModuleField({ params, request, auth, response }: HttpContext) {
    const { postId, moduleId } = params
    const path = String(request.input('path', '')).trim()
    const value = request.input('value')
    const scopeRaw = String(request.input('scope', '')).trim()
    const modeRaw = String(request.input('mode', 'source')).trim().toLowerCase()
    const mode: 'source' | 'review' | 'ai-review' =
      modeRaw === 'review'
        ? 'review'
        : modeRaw === 'ai-review' || modeRaw === 'ai_review'
          ? 'ai-review'
          : 'source'

    if (!path) return response.badRequest({ error: 'path is required' })

    // Permission gate
    const role = (auth.use('web').user as any)?.role as string | undefined
    if (!roleRegistry.hasPermission(role, 'posts.edit')) {
      return response.forbidden({ error: 'Not allowed to edit posts' })
    }

    // Verify module belongs to post and load scope/props
    const row = await db
      .from('post_modules')
      .join('module_instances', 'post_modules.module_id', 'module_instances.id')
      .select(
        'post_modules.post_id as postId',
        'post_modules.overrides as overrides',
        'post_modules.review_overrides as review_overrides',
        'post_modules.ai_review_overrides as ai_review_overrides',
        'module_instances.id as moduleInstanceId',
        'module_instances.type as moduleType',
        'module_instances.scope as moduleScope',
        'module_instances.props as props',
        'module_instances.review_props as review_props',
        'module_instances.ai_review_props as ai_review_props'
      )
      .where('post_modules.id', moduleId)
      .first()

    if (!row) return response.notFound({ error: 'Module not found' })
    if (String(row.postId) !== String(postId)) {
      return response.forbidden({ error: 'Module does not belong to this post' })
    }

    // Determine target scope
    const moduleScope: string = (row as any).moduleScope || 'post'
    let target: TargetScope =
      scopeRaw === 'props' || scopeRaw === 'overrides'
        ? (scopeRaw as TargetScope)
        : moduleScope === 'post'
          ? 'props'
          : 'overrides'

    // Basic field whitelist using module config (if available)
    try {
      const cfg = moduleRegistry.getSchema(row.moduleType)
      if (cfg?.fieldSchema && Array.isArray(cfg.fieldSchema)) {
        const rootKey = path.split(/[.[\]]/).filter(Boolean)[0]
        const fieldExists = cfg.fieldSchema.some((f: any) => f.slug === rootKey)
        if (rootKey && !fieldExists && rootKey !== '_useReact') {
          return response.badRequest({ error: `Unknown field: ${rootKey}` })
        }
      }
    } catch {
      // If registry lookup fails, proceed without blocking
    }

    // Update payload based on mode and target
    if (target === 'props') {
      const baseProps = (() => {
        const props = coerceJsonObject((row as any).props)
        const revProps = coerceJsonObject((row as any).review_props)
        const aiProps = coerceJsonObject((row as any).ai_review_props)

        if (mode === 'review') {
          return Object.keys(revProps).length > 0 ? revProps : props
        }
        if (mode === 'ai-review') {
          if (Object.keys(aiProps).length > 0) return aiProps
          if (Object.keys(revProps).length > 0) return revProps
          return props
        }
        return props
      })()
      const next = { ...baseProps }
      setAtPath(next, path, value)
      const update: Record<string, any> = { updated_at: new Date() }
      if (mode === 'review') {
        update.review_props = next
      } else if (mode === 'ai-review') {
        update.ai_review_props = next
      } else {
        update.props = next
      }
      await db
        .from('module_instances')
        .where('id', row.moduleInstanceId)
        .update(update as any)
      return response.ok({ scope: target, props: next })
    }

    // overrides path
    const baseOverrides = coerceJsonObject(
      mode === 'review'
        ? (row as any).review_overrides || (row as any).overrides
        : mode === 'ai-review'
          ? (row as any).ai_review_overrides || (row as any).overrides
          : (row as any).overrides
    )
    const nextOverrides = { ...baseOverrides }
    setAtPath(nextOverrides, path, value)
    const update: Record<string, any> = { updated_at: new Date() }
    if (mode === 'review') {
      update.review_overrides = nextOverrides
    } else if (mode === 'ai-review') {
      update.ai_review_overrides = nextOverrides
    } else {
      update.overrides = nextOverrides
    }
    await db
      .from('post_modules')
      .where('id', moduleId)
      .update(update as any)
    return response.ok({ scope: target, overrides: nextOverrides })
  }
}
