import Post from '#models/post'
import db from '@adonisjs/lucid/services/db'
import RevisionService from '#services/revision_service'

type RejectReviewDraftParams = {
  postId: string
  userId: number
  mode: 'review' | 'ai-review'
}

export default class RejectReviewDraft {
  static async handle({ postId, userId, mode }: RejectReviewDraftParams): Promise<void> {
    console.log(`[RejectReviewDraft] Rejecting ${mode} for post ${postId}`)
    await RevisionService.recordActiveVersionsSnapshot({
      postId,
      mode,
      action: mode === 'review' ? 'reject-review' : 'reject-ai-review',
      userId,
    })

    const now = new Date()
    const updateField = mode === 'review' ? 'review_draft' : 'ai_review_draft'
    const propsField = mode === 'review' ? 'review_props' : 'ai_review_props'
    const overridesField = mode === 'review' ? 'review_overrides' : 'ai_review_overrides'
    const addedField = mode === 'review' ? 'review_added' : 'ai_review_added'
    const deletedField = mode === 'review' ? 'review_deleted' : 'ai_review_deleted'

    // 1. Clear draft column
    await Post.query()
      .where('id', postId)
      .update({ [updateField]: null } as any)

    // 3. Handle module-level rejections
    await db.transaction(async (trx) => {
      // 3a. Delete modules that were ADDED in this draft mode
      const deletedCount = await trx
        .from('post_modules')
        .where('post_id', postId)
        .andWhere(addedField, true)
        .delete()
      console.log(`[RejectReviewDraft] Deleted ${deletedCount} modules added in ${mode}`)

      // 3b. Clear overrides and reset deletion flags for remaining modules
      await trx
        .from('post_modules')
        .where('post_id', postId)
        .update({
          [overridesField]: null,
          [deletedField]: false,
          updated_at: now,
        } as any)

      // 3c. Clear staged props in module_instances for modules linked to this post
      await trx
        .from('module_instances')
        .whereIn('id', trx.from('post_modules').where('post_id', postId).select('module_id'))
        .update({ [propsField]: null, updated_at: now } as any)
    })
  }
}
