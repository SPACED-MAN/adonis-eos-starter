import db from '@adonisjs/lucid/services/db'
import { coerceJsonObject } from '../../helpers/jsonb.js'

export interface PromotePostModulesParams {
  postId: string
  draftModules?: any[]
}

export default class PromotePostModules {
  /**
   * Promotes staged module changes (from review or AI review) to the live post.
   */
  static async handle({ postId, draftModules }: PromotePostModulesParams): Promise<void> {
    await db.transaction(async (trx) => {
      // Helper for deep merging during promotion
      const deepMerge = (base: any, overrides: any) => {
        if (!overrides || typeof overrides !== 'object') return base
        if (!base || typeof base !== 'object') return overrides
        const out = { ...base }
        for (const key of Object.keys(overrides)) {
          if (
            overrides[key] &&
            typeof overrides[key] === 'object' &&
            !Array.isArray(overrides[key]) &&
            base[key] &&
            typeof base[key] === 'object' &&
            !Array.isArray(base[key])
          ) {
            out[key] = deepMerge(base[key], overrides[key])
          } else {
            out[key] = overrides[key]
          }
        }
        return out
      }

      // If we have an explicit modules list (atomic draft), use it for promotion
      if (Array.isArray(draftModules)) {
        for (const dm of draftModules) {
          const isLocal = dm.scope === 'post' || dm.scope === 'local'
          const nextAdminLabel = dm.adminLabel
          if (isLocal) {
            const miId = dm.moduleInstanceId
            if (miId) {
              // Get current props to ensure we don't accidentally lose any fields
              // although atomic drafts are supposed to be complete.
              const existing = await trx
                .from('module_instances')
                .where('id', miId)
                .select('props')
                .first()
              const currentProps = coerceJsonObject(existing?.props)

              await trx
                .from('module_instances')
                .where('id', miId)
                .update({
                  props: deepMerge(currentProps, dm.props || {}),
                  review_props: null,
                  ai_review_props: null,
                  updated_at: new Date(),
                } as any)
            }
          } else {
            const existing = await trx
              .from('post_modules')
              .where('id', dm.id)
              .select('overrides')
              .first()
            const currentOverrides = coerceJsonObject(existing?.overrides)

            await trx
              .from('post_modules')
              .where('id', dm.id)
              .update({
                overrides: deepMerge(currentOverrides, dm.overrides || null),
                review_overrides: null,
                ai_review_overrides: null,
                ...(nextAdminLabel !== undefined ? { admin_label: nextAdminLabel } : {}),
                updated_at: new Date(),
              } as any)
          }

          // Apply label to Source for BOTH local and global modules (label is on post_modules).
          if (nextAdminLabel !== undefined) {
            await trx
              .from('post_modules')
              .where('id', dm.id)
              .update({ admin_label: nextAdminLabel, updated_at: new Date() } as any)
          }
        }
        return
      }

      // Fallback: Promote via DB columns (when atomic draft modules list is missing)
      const moduleInstances = await trx
        .from('module_instances')
        .whereIn('id', trx.from('post_modules').where('post_id', postId).select('module_id'))
        .select('id', 'props', 'review_props', 'ai_review_props')

      for (const instance of moduleInstances) {
        const props = coerceJsonObject(instance.props)
        const reviewProps = coerceJsonObject(instance.review_props)
        const aiReviewProps = coerceJsonObject(instance.ai_review_props)

        // Merge hierarchy: AI Review -> Review -> Source
        let mergedProps = props
        if (Object.keys(reviewProps).length > 0) {
          mergedProps = deepMerge(mergedProps, reviewProps)
        }
        if (Object.keys(aiReviewProps).length > 0) {
          mergedProps = deepMerge(mergedProps, aiReviewProps)
        }

        await trx
          .from('module_instances')
          .where('id', instance.id)
          .update({
            props: mergedProps,
            review_props: null,
            ai_review_props: null,
            updated_at: new Date(),
          } as any)
      }

      // Promote overrides (Join table)
      const pmsToUpdate = await trx
        .from('post_modules')
        .where('post_id', postId)
        .where((q) => q.whereNotNull('ai_review_overrides').orWhereNotNull('review_overrides'))
        .select('id', 'overrides', 'review_overrides', 'ai_review_overrides')

      for (const pm of pmsToUpdate) {
        const overrides = coerceJsonObject(pm.overrides)
        const reviewOverrides = coerceJsonObject(pm.review_overrides)
        const aiReviewOverrides = coerceJsonObject(pm.ai_review_overrides)

        // Merge hierarchy: AI Review -> Review -> Source
        let mergedOverrides = overrides
        if (Object.keys(reviewOverrides).length > 0) {
          mergedOverrides = { ...overrides, ...reviewOverrides }
        }
        if (Object.keys(aiReviewOverrides).length > 0) {
          mergedOverrides = { ...mergedOverrides, ...aiReviewOverrides }
        }

        await trx.from('post_modules').where('id', pm.id).update({
          overrides: mergedOverrides,
          review_overrides: null,
          ai_review_overrides: null,
          updated_at: new Date(),
        })
      }

      // Delete modules marked for deletion
      await trx
        .from('post_modules')
        .where('post_id', postId)
        .andWhere((q) => q.where('review_deleted', true).orWhere('ai_review_deleted', true))
        .delete()

      // Finalize newly added modules (flags only - props/overrides already promoted above)
      await trx
        .from('post_modules')
        .where('post_id', postId)
        .andWhere((q) => q.where('review_added', true).orWhere('ai_review_added', true))
        .update({
          review_added: false,
          ai_review_added: false,
          updated_at: new Date(),
        })
    })
  }
}
