import Post from '#models/post'
import db from '@adonisjs/lucid/services/db'
import { coerceJsonObject } from '../../helpers/jsonb.js'

type PromoteAiReviewToReviewParams = {
  postId: string
  userId: number
  userEmail?: string | null
}

/**
 * Action to promote an AI Review draft into a standard Review draft.
 * This moves post-level fields and all module-level staging (props/overrides/added/deleted).
 */
export default class PromoteAiReviewToReview {
  static async handle({ postId, userId, userEmail }: PromoteAiReviewToReviewParams): Promise<void> {
    const post = await Post.findOrFail(postId)
    
    // 1. Prepare post-level draft
    const ard = coerceJsonObject(post.aiReviewDraft)
    const rd = coerceJsonObject(post.reviewDraft)
    
    // Merge existing Review draft with AI Review changes
    const mergedPostDraft = {
      ...rd,
      ...ard,
      savedAt: new Date().toISOString(),
      savedBy: userEmail || 'AI Promotion',
    }

    await db.transaction(async (trx) => {
      // 2. Promote Module Instances (ai_review_props -> review_props)
      const postModules = await trx
        .from('post_modules')
        .where('post_id', postId)
        .select('module_id')

      const moduleIds = postModules.map(pm => pm.module_id)

      if (moduleIds.length > 0) {
        const modulesToUpdate = await trx
          .from('module_instances')
          .whereIn('id', moduleIds)
          .whereNotNull('ai_review_props')
          .select('id', 'props', 'review_props', 'ai_review_props')

        for (const mi of modulesToUpdate) {
          const currentProps = coerceJsonObject(mi.review_props || mi.props)
          const aiProps = coerceJsonObject(mi.ai_review_props)
          
          await trx
            .from('module_instances')
            .where('id', mi.id)
            .update({
              review_props: { ...currentProps, ...aiProps },
              ai_review_props: null,
              updated_at: new Date()
            } as any)
        }
      }

      // 3. Promote Post Module Join Table (ai_review_overrides/added/deleted)
      const pmsToUpdate = await trx
        .from('post_modules')
        .where('post_id', postId)
        .where((query) => {
          query.whereNotNull('ai_review_overrides')
            .orWhere('ai_review_added', true)
            .orWhere('ai_review_deleted', true)
        })
        .select('id', 'overrides', 'review_overrides', 'ai_review_overrides', 'ai_review_added', 'ai_review_deleted')

      for (const pm of pmsToUpdate) {
        const currentOverrides = coerceJsonObject(pm.review_overrides || pm.overrides)
        const aiOverrides = coerceJsonObject(pm.ai_review_overrides)
        
        const updatePayload: any = {
          review_added: pm.ai_review_added ? true : (pm.review_added || false),
          review_deleted: pm.ai_review_deleted ? true : (pm.review_deleted || false),
          ai_review_overrides: null,
          ai_review_added: false,
          ai_review_deleted: false,
          updated_at: new Date()
        }

        if (pm.ai_review_overrides) {
          updatePayload.review_overrides = { ...currentOverrides, ...aiOverrides }
        }

        await trx
          .from('post_modules')
          .where('id', pm.id)
          .update(updatePayload)
      }

      // 4. Update the main post draft
      await trx
        .from('posts')
        .where('id', postId)
        .update({
          review_draft: mergedPostDraft,
          ai_review_draft: null,
          updated_at: new Date()
        } as any)
    })

    // 5. Promote execution history
    try {
      const agentExecutionService = (await import('#services/agent_execution_service')).default
      await agentExecutionService.promoteAiReviewToReview(postId)
    } catch (e) {
      console.error('Failed to promote agent history during AI Review approval:', e)
    }
  }
}

