import Post from '#models/post'
import db from '@adonisjs/lucid/services/db'

type PromoteVariationParams = {
  postId: string // The ID of the variation that should become the main version
  userId: number
}

export default class PromoteVariation {
  /**
   * Promotes a variation to be the main post.
   * This effectively ends the A/B test and makes this version the live content.
   */
  static async handle({ postId, userId }: PromoteVariationParams): Promise<Post> {
    const winner = await Post.findOrFail(postId)
    
    // If it doesn't have an abGroupId, it's not part of an A/B test
    if (!winner.abGroupId) {
      throw new Error('This post is not part of an A/B test group.')
    }

    const mainPost = await Post.findOrFail(winner.abGroupId)

    return await db.transaction(async (trx) => {
      if (winner.id !== mainPost.id) {
        // 1. Copy content from winner to mainPost
        // We preserve mainPost's ID, slug, type, locale, and parentId
        mainPost.title = winner.title
        mainPost.excerpt = winner.excerpt
        mainPost.featuredImageId = winner.featuredImageId
        mainPost.metaTitle = winner.metaTitle
        mainPost.metaDescription = winner.metaDescription
        mainPost.robotsJson = winner.robotsJson
        mainPost.jsonldOverrides = winner.jsonldOverrides
        mainPost.status = winner.status
        mainPost.updatedAt = winner.updatedAt
        mainPost.publishedAt = winner.publishedAt
        mainPost.scheduledAt = winner.scheduledAt
        
        await mainPost.useTransaction(trx).save()

        // 2. Transfer modules
        // Delete mainPost's current modules
        await trx.from('post_modules').where('post_id', mainPost.id).delete()
        // Reassign winner's modules to mainPost
        await trx.from('post_modules').where('post_id', winner.id).update({ post_id: mainPost.id })

        // 3. Transfer custom field values
        await trx.from('post_custom_field_values').where('post_id', mainPost.id).delete()
        await trx.from('post_custom_field_values').where('post_id', winner.id).update({ post_id: mainPost.id })

        // 4. Transfer taxonomy terms
        await trx.from('post_taxonomy_terms').where('post_id', mainPost.id).delete()
        await trx.from('post_taxonomy_terms').where('post_id', winner.id).update({ post_id: mainPost.id })
      }

      // 5. Delete all other variations in the group
      await Post.query({ client: trx })
        .where('abGroupId', mainPost.id)
        .whereNot('id', mainPost.id)
        .delete()

      // 6. Clear A/B testing fields on the main post to mark it as no longer in a test
      mainPost.abVariation = null
      mainPost.abGroupId = null
      await mainPost.useTransaction(trx).save()

      // Log activity
      try {
        const activityService = (await import('#services/activity_log_service')).default
        await activityService.log({
          action: 'post.ab_test.promote',
          userId: userId,
          entityType: 'post',
          entityId: mainPost.id,
          metadata: { variation: winner.abVariation, winnerId: winner.id },
        })
      } catch {
        /* ignore */
      }

      return mainPost
    })
  }
}

