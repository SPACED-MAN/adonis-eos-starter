import PostModule from '#models/post_module'
import postTypeConfigService from '#services/post_type_config_service'
import { coerceJsonObject } from '../../helpers/jsonb.js'
import db from '@adonisjs/lucid/services/db'

type UpdatePostModuleParams = {
  postModuleId: string
  orderIndex?: number
  overrides?: Record<string, any> | null
  locked?: boolean
  adminLabel?: string | null
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
    adminLabel,
    mode,
  }: UpdatePostModuleParams) {
    // NOTE: Keep this action stable; it's used heavily by the editor.
    if (!isUuid(postModuleId)) {
      throw new UpdatePostModuleException('Invalid post module id', 400, { postModuleId })
    }

    // Find the post_module using Lucid
    const postModule = await PostModule.query().where('id', postModuleId).first()

    if (!postModule) {
      throw new UpdatePostModuleException('Post module not found', 404, { postModuleId })
    }

    // Load post to check config
    await postModule.load('moduleInstance')
    const mi = postModule.moduleInstance

    const postRow = await db.from('posts').where('id', postModule.postId).first()
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

    if (orderIndex !== undefined) {
      // Only apply order changes to approved version; review/ai-review ordering is staged
      if (mode !== 'review' && mode !== 'ai-review') {
        postModule.orderIndex = orderIndex
      }
    }

    // IMPORTANT:
    // - Source label (post_modules.admin_label) should ONLY change on publish/source saves.
    // - Review/AI Review label changes must stay in the draft snapshot until promoted.
    if (adminLabel !== undefined && mode !== 'review' && mode !== 'ai-review') {
      postModule.adminLabel = adminLabel
    }

    // If overrides provided and module is local (scope='post'), merge into module props instead
    // to reflect that local modules own their props rather than using per-post overrides.
    if (overrides !== undefined) {
      if (mi && mi.scope === 'post') {
        // Local module: edit props; in review/ai-review mode, write to review_props/ai_review_props
        const baseProps = (() => {
          const props = coerceJsonObject(mi.props)
          const revProps = coerceJsonObject(mi.reviewProps)
          const aiProps = coerceJsonObject(mi.aiReviewProps)

          if (mode === 'ai-review') {
            if (Object.keys(aiProps).length > 0) return aiProps
            if (Object.keys(revProps).length > 0) return revProps
            return props
          }
          if (mode === 'review') {
            if (Object.keys(revProps).length > 0) return revProps
            return props
          }
          return props
        })()

        // Deep-merge overrides
        const mergedProps = UpdatePostModule.deepMerge(baseProps, overrides || {})

        if (mode === 'ai-review') {
          mi.aiReviewProps = mergedProps
        } else if (mode === 'review') {
          mi.reviewProps = mergedProps
        } else {
          mi.props = mergedProps
        }
        await mi.save()

        // Clear standard overrides for local modules
        if (mode === 'ai-review') {
          postModule.aiReviewOverrides = null
        } else if (mode === 'review') {
          postModule.reviewOverrides = null
        } else {
          postModule.overrides = null
        }
      } else {
        // Global: edit overrides on join table
        const finalOverrides = overrides

        if (mode === 'ai-review') {
          postModule.aiReviewOverrides = finalOverrides
        } else if (mode === 'review') {
          postModule.reviewOverrides = finalOverrides
        } else {
          postModule.overrides = finalOverrides
        }
      }
    }

    if (locked !== undefined) {
      postModule.locked = locked
    }

    await postModule.save()

    return postModule
  }
}
