import Post from '#models/post'
import db from '@adonisjs/lucid/services/db'

type DeleteVariationParams = {
  postId: string
  userId: number
}

export default class DeleteVariation {
  /**
   * Deletes a variation and cleans up the A/B test group if necessary.
   */
  static async handle({ postId, userId }: DeleteVariationParams): Promise<{ message: string; remainingPostId?: string }> {
    const postToDelete = await Post.findOrFail(postId)
    const abGroupId = postToDelete.abGroupId

    if (!abGroupId) {
      throw new Error('This post is not part of an A/B test.')
    }

    return await db.transaction(async (trx) => {
      // Use standard soft delete
      await postToDelete.useTransaction(trx).softDelete()

      // Log activity
      try {
        const activityService = (await import('#services/activity_log_service')).default
        await activityService.log({
          action: 'post.ab_test.delete_variation',
          userId: userId,
          entityType: 'post',
          entityId: postToDelete.id,
          metadata: { variation: postToDelete.abVariation, abGroupId },
        })
      } catch {
        /* ignore */
      }

      // Check how many variations are left in this group (excluding the one we just deleted)
      const remaining = await Post.query({ client: trx })
        .where('abGroupId', abGroupId)
        .whereNull('deleted_at')
        .count('* as total')

      const totalRemaining = Number(remaining[0].$extras.total || 0)

      if (totalRemaining <= 1) {
        // If only one remains, it's no longer an A/B test. Convert it back to a normal post.
        const lastPost = await Post.query({ client: trx })
          .where('abGroupId', abGroupId)
          .whereNull('deleted_at')
          .first()

        if (lastPost) {
          lastPost.abGroupId = null
          lastPost.abVariation = null
          await lastPost.save()
          return { message: 'Variation deleted. A/B test ended as only one variation remains.', remainingPostId: lastPost.id }
        }
      }

      // If we deleted the "primary" post (the one whose ID == abGroupId), we need to pick a new primary
      if (postToDelete.id === abGroupId && totalRemaining > 0) {
        const newPrimary = await Post.query({ client: trx })
          .where('abGroupId', abGroupId)
          .whereNull('deleted_at')
          .first()
        
        if (newPrimary) {
          // Re-assign all variations to this new primary ID
          await trx.from('posts').where('ab_group_id', abGroupId).update({ ab_group_id: newPrimary.id })
          return { message: 'Variation deleted. New primary assigned.', remainingPostId: newPrimary.id }
        }
      }

      return { message: 'Variation deleted successfully.' }
    })
  }
}

