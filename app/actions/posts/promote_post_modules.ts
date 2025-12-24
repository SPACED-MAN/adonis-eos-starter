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
      // If we have an explicit modules list (atomic draft), use it for promotion
      if (Array.isArray(draftModules)) {
        for (const dm of draftModules) {
          const isLocal = dm.scope === 'post' || dm.scope === 'local'
          const nextAdminLabel = dm.adminLabel
          if (isLocal) {
            const miId = dm.moduleInstanceId
            if (miId) {
              await trx
                .from('module_instances')
                .where('id', miId)
                .update({
                  props: dm.props || {},
                  review_props: null,
                  ai_review_props: null,
                  updated_at: new Date(),
                } as any)
            }
          } else {
            await trx
              .from('post_modules')
              .where('id', dm.id)
              .update({
                overrides: dm.overrides || null,
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
        .where('scope', 'post')
        .andWhereIn('id', trx.from('post_modules').where('post_id', postId).select('module_id'))
        .select('id', 'props', 'review_props')

      for (const instance of moduleInstances) {
        const props = coerceJsonObject(instance.props)
        const reviewProps = coerceJsonObject(instance.review_props)

        // Merge: review_props overrides base props
        const mergedProps = Object.keys(reviewProps).length > 0 ? { ...props, ...reviewProps } : props

        await trx
          .from('module_instances')
          .where('id', instance.id)
          .update({
            props: mergedProps,
            review_props: null,
            updated_at: new Date(),
          } as any)
      }

      // Promote review_overrides to overrides
      await trx
        .from('post_modules')
        .where('post_id', postId)
        .update({
          overrides: trx.raw('COALESCE(review_overrides, overrides)'),
          review_overrides: null,
          updated_at: new Date(),
        })

      // Delete modules marked for deletion
      await trx.from('post_modules').where('post_id', postId).andWhere('review_deleted', true).delete()

      // Finalize newly added modules
      await trx
        .from('post_modules')
        .where('post_id', postId)
        .andWhere('review_added', true)
        .update({ review_added: false, updated_at: new Date() })
    })
  }
}

