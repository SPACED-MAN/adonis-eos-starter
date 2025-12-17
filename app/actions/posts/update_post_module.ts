import db from '@adonisjs/lucid/services/db'
import postTypeConfigService from '#services/post_type_config_service'
import { coerceJsonObject } from '../../helpers/jsonb.js'

type UpdatePostModuleParams = {
  postModuleId: string
  orderIndex?: number
  overrides?: Record<string, any> | null
  locked?: boolean
  mode?: 'review' | 'ai-review' | 'publish'
}

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const isUuid = (val: unknown): val is string => typeof val === 'string' && uuidRegex.test(val)

export class UpdatePostModuleException extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public meta?: Record<string, any>
  ) {
    super(message)
    this.name = 'UpdatePostModuleException'
  }
}

export default class UpdatePostModule {
  private static deepMerge(
    base: Record<string, any>,
    override: Record<string, any> | null | undefined
  ): Record<string, any> {
    if (!override || typeof override !== 'object') return { ...base }
    const out: Record<string, any> = Array.isArray(base) ? [...(base as any)] : { ...base }
    for (const key of Object.keys(override)) {
      const oVal = (override as any)[key]
      const bVal = (base as any)[key]
      if (
        oVal &&
        typeof oVal === 'object' &&
        !Array.isArray(oVal) &&
        bVal &&
        typeof bVal === 'object' &&
        !Array.isArray(bVal)
      ) {
        out[key] = UpdatePostModule.deepMerge(bVal, oVal)
      } else {
        // For arrays and primitives: replace entirely
        out[key] = oVal
      }
    }
    return out
  }
  static async handle({
    postModuleId,
    orderIndex,
    overrides,
    locked,
    mode,
  }: UpdatePostModuleParams) {
    if (!isUuid(postModuleId)) {
      throw new UpdatePostModuleException('Invalid post module id', 400, { postModuleId })
    }

    // Find the post_module
    const postModule = await db.from('post_modules').where('id', postModuleId).first()

    if (!postModule) {
      throw new UpdatePostModuleException('Post module not found', 404, { postModuleId })
    }

    const postRow = await db.from('posts').where('id', postModule.post_id).first()
    if (!postRow) {
      throw new UpdatePostModuleException('Post not found for module', 404, { postModuleId })
    }
    const postTypeConfig = postTypeConfigService.getUiConfig((postRow as any).type)
    const modulesEnabled =
      postTypeConfig.modulesEnabled !== false && postTypeConfig.urlPatterns.length > 0
    if (!modulesEnabled) {
      throw new UpdatePostModuleException('Modules are disabled for this post type', 400, {
        postType: (postRow as any).type,
      })
    }

    if (postModule.locked && orderIndex !== undefined) {
      throw new UpdatePostModuleException('Cannot reorder a locked module', 400, {
        postModuleId,
      })
    }

    // Build update object for post_modules
    const updateData: Record<string, any> = {
      updated_at: new Date(),
    }

    if (orderIndex !== undefined) {
      // Only apply order changes to approved version; review/ai-review ordering is staged
      if (mode !== 'review' && mode !== 'ai-review') {
        updateData.order_index = orderIndex
      }
    }

    // If overrides provided and module is local (scope='post'), merge into module props instead
    // to reflect that local modules own their props rather than using per-post overrides.
    if (overrides !== undefined) {
      const moduleInstance = await db
        .from('module_instances')
        .where('id', postModule.module_id)
        .first()
      if (moduleInstance && moduleInstance.scope === 'post') {
        // Local module: edit props; in review/ai-review mode, write to review_props/ai_review_props
        const baseProps = (() => {
          const props = coerceJsonObject(moduleInstance.props)
          const revProps = coerceJsonObject((moduleInstance as any).review_props)
          const aiProps = coerceJsonObject((moduleInstance as any).ai_review_props)

          if (mode === 'ai-review') {
            // Priority: AI Review > Review > Source
            if (Object.keys(aiProps).length > 0) return aiProps
            if (Object.keys(revProps).length > 0) return revProps
            return props
          }
          if (mode === 'review') {
            // Priority: Review > Source
            if (Object.keys(revProps).length > 0) return revProps
            return props
          }
          return props
        })()
        // Deep-merge overrides to preserve nested richtext JSON
        const mergedProps = UpdatePostModule.deepMerge(baseProps, overrides || {})
        const propsColumn =
          mode === 'ai-review' ? 'ai_review_props' : mode === 'review' ? 'review_props' : 'props'
        await db
          .from('module_instances')
          .where('id', postModule.module_id)
          .update({
            [propsColumn]: mergedProps,
            updated_at: new Date(),
          } as any)
        // Clear standard overrides for local modules (both fields)
        if (mode === 'ai-review') {
          updateData.ai_review_overrides = null
        } else if (mode === 'review') {
          updateData.review_overrides = null
        } else {
          updateData.overrides = null
        }
      } else {
        // Global: edit overrides on join table; in review/ai-review mode, write to review_overrides/ai_review_overrides
        if (mode === 'ai-review') {
          updateData.ai_review_overrides = overrides
        } else if (mode === 'review') {
          updateData.review_overrides = overrides
        } else {
          updateData.overrides = overrides
        }
      }
    }

    if (locked !== undefined) {
      updateData.locked = locked
    }

    // Update the post_module
    const [updated] = await db
      .from('post_modules')
      .where('id', postModuleId)
      .update(updateData)
      .returning('*')

    return updated
  }
}
